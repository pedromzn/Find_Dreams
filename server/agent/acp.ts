/**
 * The ACP client: starts the person's agent as a child process, speaks JSON-RPC over its stdio with the official SDK
 * (`@agentclientprotocol/sdk` 2.x — `client()` / `connect()`; there is no `ClientSideConnection` any more), and turns
 * what the agent does into simple events for the page: text, tool calls, permission requests, the end.
 *
 * The workspace is the agent's `cwd`. The app answers the agent's file requests only inside the workspace and never
 * inside `.mzn/`; a permission request becomes buttons on the page and waits for the person (or the run's policy).
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import * as acp from '@agentclientprotocol/sdk'
import { config } from '../config.js'
import { log } from '../logger.js'
import { writeFileAtomic } from '../store/workspace.js'
import type { Launch } from './registry.js'

export type AgentEvent =
  | { kind: 'text'; text: string }
  | { kind: 'thought'; text: string }
  | { kind: 'tool'; id: string; title: string; status: string; toolKind?: string }
  | { kind: 'permission'; id: string; title: string; options: Array<{ id: string; name: string; kind: string }> }
  | { kind: 'permission_resolved'; id: string }
  | { kind: 'plan'; entries: Array<{ content: string; status: string }> }
  | { kind: 'stderr'; text: string }

type PermissionPolicy = 'ask' | 'allow_once' | 'reject'

/** A file the agent may read or write through the client: inside the workspace, outside `.mzn/`. */
export function insideWorkspace(file: string): string {
  const refuse = () => acp.RequestError.invalidParams({ path: file }, 'Outside the workspace.')
  mkdirSync(config.workspaceFolder, { recursive: true })
  const workspace = realpathSync(config.workspaceFolder)
  // links resolved on the deepest folder that exists: a symlink inside the workspace must not lead outside it
  let existing = path.resolve(workspace, file)
  const rest: string[] = []
  while (!existsSync(existing)) {
    rest.unshift(path.basename(existing))
    const parent = path.dirname(existing)
    if (parent === existing) throw refuse()
    existing = parent
  }
  const absolute = path.join(realpathSync(existing), ...rest)
  const relative = path.relative(workspace, absolute)
  // case-insensitive: on macOS and Windows ".MZN" is the same folder as ".mzn"
  const first = relative.split(path.sep)[0]?.toLowerCase()
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || first === '.mzn') throw refuse()
  return absolute
}

export class AgentSession {
  private child: ChildProcess | null = null
  private connection: acp.ClientConnection | null = null
  private sessionId: string | null = null
  private pending = new Map<string, (optionId: string | null) => void>()
  private stderrTail = ''

  constructor(
    private readonly launch: Launch,
    private readonly env: NodeJS.ProcessEnv,
    private readonly onEvent: (e: AgentEvent) => void,
    private readonly policy: PermissionPolicy = 'ask',
  ) {}

  /** Spawns, initializes and opens a session in the workspace. Rejects with a readable message on failure. */
  async start(systemPrompt?: string): Promise<void> {
    // a missing cwd makes spawn fail with a misleading ENOENT for the binary itself
    mkdirSync(config.workspaceFolder, { recursive: true })
    const child = spawn(this.launch.command, this.launch.args, {
      cwd: config.workspaceFolder,
      env: this.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      // .cmd shims (npx, npm-installed CLIs) need a shell on Windows
      shell: process.platform === 'win32',
      windowsHide: true,
    })
    this.child = child
    child.stderr!.setEncoding('utf8')
    child.stderr!.on('data', (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-4000)
    })
    let exitError: Error | null = null
    const exited = new Promise<never>((_, fail) => {
      child.once('error', (e) => fail((exitError = new Error(`Could not start ${this.launch.command}: ${e.message}`))))
      child.once('exit', (code) =>
        fail(
          (exitError = new Error(
            `The agent exited (code ${code}). ${this.stderrTail.split('\n').slice(-5).join(' ').trim()}`,
          )),
        ),
      )
    })
    exited.catch(() => undefined)

    const stream = acp.ndJsonStream(
      Writable.toWeb(child.stdin!) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>,
    )
    this.connection = acp
      .client({ name: 'mzn-vagas' })
      .onRequest(acp.methods.client.session.requestPermission, ({ params }) => this.askPermission(params))
      .onRequest(acp.methods.client.fs.readTextFile, ({ params }) => {
        const text = readFileSync(insideWorkspace(params.path), 'utf8')
        if (!params.line && !params.limit) return { content: text }
        const lines = text.split('\n')
        const from = Math.max(0, (params.line ?? 1) - 1)
        return { content: lines.slice(from, params.limit ? from + params.limit : undefined).join('\n') }
      })
      .onRequest(acp.methods.client.fs.writeTextFile, ({ params }) => {
        writeFileAtomic(insideWorkspace(params.path), params.content)
        return {}
      })
      .onNotification(acp.methods.client.session.update, ({ params }) => this.update(params.update))
      .connect(stream)

    const ready = (async () => {
      await this.connection!.agent.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
        clientInfo: { name: 'mzn-vagas', version: '0.1.0' },
      })
      const session = await this.connection!.agent.request(acp.methods.agent.session.new, {
        cwd: config.workspaceFolder,
        mcpServers: [],
        ...(systemPrompt ? { systemPrompt } : {}),
      } as acp.NewSessionRequest)
      this.sessionId = session.sessionId
    })()
    try {
      await Promise.race([ready, exited, timeout(60_000, 'The agent did not answer in 60 s.')])
    } catch (e) {
      // "connection closed" usually races the exit event, which carries the useful part (stderr): prefer it
      await new Promise((r) => setTimeout(r, 200))
      throw exitError ?? e
    }
  }

  /** Sends a prompt and resolves when the agent finishes the turn. */
  async prompt(text: string): Promise<acp.StopReason> {
    if (!this.connection || !this.sessionId) throw new Error('The agent session is not open.')
    const res = await this.connection.agent.request(acp.methods.agent.session.prompt, {
      sessionId: this.sessionId,
      prompt: [{ type: 'text', text }],
    })
    // the SDK dispatches notifications without awaiting their handlers, so the last chunks sent right before the
    // response may still be queued: let them land before the caller closes the session
    await new Promise((r) => setTimeout(r, 50))
    return res.stopReason
  }

  async cancel(): Promise<void> {
    if (!this.connection || !this.sessionId) return
    for (const resolve of this.pending.values()) resolve(null)
    this.pending.clear()
    await this.connection.agent
      .notify(acp.methods.agent.session.cancel, { sessionId: this.sessionId })
      .catch(() => undefined)
  }

  /** The page answered a permission request: an option id, or null to refuse. */
  answerPermission(id: string, optionId: string | null): boolean {
    const resolve = this.pending.get(id)
    if (!resolve) return false
    this.pending.delete(id)
    resolve(optionId)
    this.onEvent({ kind: 'permission_resolved', id })
    return true
  }

  close(): void {
    for (const resolve of this.pending.values()) resolve(null)
    this.pending.clear()
    this.connection?.close()
    if (this.child && this.child.exitCode === null) {
      const child = this.child
      if (process.platform === 'win32' && child.pid) {
        // on Windows the agent runs under cmd.exe (shell: true): killing the shell would orphan the agent, which keeps
        // running and keeps the workspace folder locked. End the whole tree.
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on(
          'error',
          () => child.kill(),
        )
      } else {
        child.kill()
        setTimeout(() => child.exitCode === null && child.kill('SIGKILL'), 3000).unref()
      }
    }
    this.connection = null
    this.child = null
  }

  get stderr(): string {
    return this.stderrTail
  }

  private askPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    const pick = (kind: string) => params.options.find((o) => o.kind === kind)?.optionId ?? null
    if (this.policy !== 'ask') {
      const optionId = this.policy === 'allow_once' ? pick('allow_once') : pick('reject_once')
      return Promise.resolve(
        optionId ? { outcome: { outcome: 'selected', optionId } } : { outcome: { outcome: 'cancelled' } },
      )
    }
    const id = params.toolCall.toolCallId
    // register before announcing: whoever answers may do it synchronously, inside onEvent
    const answer = new Promise<acp.RequestPermissionResponse>((resolve) => {
      this.pending.set(id, (optionId) =>
        resolve(optionId ? { outcome: { outcome: 'selected', optionId } } : { outcome: { outcome: 'cancelled' } }),
      )
    })
    this.onEvent({
      kind: 'permission',
      id,
      title: params.toolCall.title ?? id,
      options: params.options.map((o) => ({ id: o.optionId, name: o.name, kind: o.kind })),
    })
    return answer
  }

  private update(u: acp.SessionUpdate): void {
    try {
      switch (u.sessionUpdate) {
        case 'agent_message_chunk':
          if (u.content.type === 'text') this.onEvent({ kind: 'text', text: u.content.text })
          break
        case 'agent_thought_chunk':
          if (u.content.type === 'text') this.onEvent({ kind: 'thought', text: u.content.text })
          break
        case 'tool_call':
          this.onEvent({
            kind: 'tool',
            id: u.toolCallId,
            title: u.title,
            status: u.status ?? 'pending',
            toolKind: u.kind ?? undefined,
          })
          break
        case 'tool_call_update':
          this.onEvent({ kind: 'tool', id: u.toolCallId, title: u.title ?? '', status: u.status ?? 'in_progress' })
          break
        case 'plan':
          this.onEvent({ kind: 'plan', entries: u.entries.map((e) => ({ content: e.content, status: e.status })) })
          break
        default:
          break
      }
    } catch (error) {
      log.warn('agent update not understood', { error })
    }
  }
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, fail) => setTimeout(() => fail(new Error(message)), ms).unref())
}
