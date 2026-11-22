/**
 * Runs: a request handed to the connected agent, end to end, without a terminal. Each run streams its events to the
 * page (`/api/events`, type `agent`), keeps a short transcript in memory for the agent panel, and records its outcome
 * in SQLite (`agent_runs`) for the history. One run per request at a time.
 */

import { randomUUID } from 'node:crypto'
import { getDb } from '../store/db.js'
import { getPreference } from '../store/settings.js'
import { secrets } from '../secrets.js'
import { HttpError } from '../errors.js'
import { log } from '../logger.js'
import { AgentSession, type AgentEvent } from './acp.js'
import { broadcast } from './events.js'
import { agentEnv, detect, findAgent, type AgentDefinition } from './registry.js'
import { markDone, promptFor, readRequest } from './requests.js'
import { childEnv } from './shellPath.js'

export type RunStatus = 'starting' | 'running' | 'done' | 'failed' | 'cancelled'

export interface Run {
  id: string
  requestId: string | null
  agent: string
  status: RunStatus
  startedAt: string
  endedAt: string | null
  /** the agent's text so far, and its tool calls (for the panel) */
  text: string
  tools: Array<{ id: string; title: string; status: string }>
  permissions: Array<{ id: string; title: string; options: Array<{ id: string; name: string; kind: string }> }>
  error: string | null
}

const runs = new Map<string, { run: Run; session: AgentSession | null }>()
const MAX_KEPT = 30

export function selectedAgent(): string | null {
  return getPreference('agent')
}

async function launchFor(def: AgentDefinition) {
  const found = await detect(def)
  if (!found.launch) throw new HttpError(409, `${def.name} is not installed.`, 'agent_missing')
  return { launch: found.launch, env: await childEnv(await agentEnv(def, secrets.get)) }
}

function emit(run: Run, event: AgentEvent | { kind: 'status'; status: RunStatus; error?: string | null }) {
  broadcast({ type: 'agent', payload: { runId: run.id, requestId: run.requestId, ...event } })
}

function record(run: Run) {
  try {
    getDb()
      .prepare(
        `INSERT INTO agent_runs (id, request_id, agent, status, started_at, ended_at, error) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET status = excluded.status, ended_at = excluded.ended_at, error = excluded.error`,
      )
      .run(run.id, run.requestId, run.agent, run.status, run.startedAt, run.endedAt, run.error)
  } catch (error) {
    log.warn('agent run not recorded', { error })
  }
}

function keep(entry: { run: Run; session: AgentSession | null }) {
  runs.set(entry.run.id, entry)
  while (runs.size > MAX_KEPT) runs.delete(runs.keys().next().value!)
}

function track(run: Run): (e: AgentEvent) => void {
  return (e) => {
    if (e.kind === 'text') run.text += e.text
    else if (e.kind === 'tool') {
      const known = run.tools.find((t) => t.id === e.id)
      if (known) Object.assign(known, { status: e.status, ...(e.title ? { title: e.title } : {}) })
      else run.tools.push({ id: e.id, title: e.title, status: e.status })
    } else if (e.kind === 'permission') run.permissions.push({ id: e.id, title: e.title, options: e.options })
    else if (e.kind === 'permission_resolved') run.permissions = run.permissions.filter((p) => p.id !== e.id)
    emit(run, e)
  }
}

/** Starts a request with an agent (the selected one by default). Returns at once; the run streams. */
export async function startRun(requestId: string, agentId = selectedAgent()): Promise<Run> {
  const request = readRequest(requestId)
  if (!agentId) throw new HttpError(409, 'Choose an agent first.', 'agent_missing')
  const def = findAgent(agentId)
  if (!def) throw new HttpError(404, 'Unknown agent.', 'not_found')
  for (const { run } of runs.values()) {
    if (run.requestId === requestId && (run.status === 'starting' || run.status === 'running')) return run
  }
  const { launch, env } = await launchFor(def)
  const run: Run = {
    id: randomUUID(),
    requestId,
    agent: def.id,
    status: 'starting',
    startedAt: new Date().toISOString(),
    endedAt: null,
    text: '',
    tools: [],
    permissions: [],
    error: null,
  }
  const session = new AgentSession(launch, env, track(run), 'ask')
  keep({ run, session })
  record(run)
  const finish = (status: RunStatus, error: string | null = null) => {
    run.status = status
    run.error = error
    run.endedAt = new Date().toISOString()
    run.permissions = []
    session.close()
    record(run)
    emit(run, { kind: 'status', status, error })
  }
  void (async () => {
    try {
      await session.start()
      run.status = 'running'
      emit(run, { kind: 'status', status: 'running' })
      const stop = await session.prompt(promptFor(request).prompt)
      if (stop === 'cancelled') return finish('cancelled')
      // the AI is asked to mark the request done; mark it here too, so the history is right either way
      try {
        markDone(requestId)
      } catch {
        /* the request file was removed meanwhile */
      }
      finish(stop === 'end_turn' ? 'done' : 'failed', stop === 'end_turn' ? null : `Stopped: ${stop}`)
    } catch (e) {
      finish(run.status === 'cancelled' ? 'cancelled' : 'failed', e instanceof Error ? e.message : String(e))
    }
  })()
  return run
}

export function listRuns(): Run[] {
  return [...runs.values()].map((r) => r.run).reverse()
}

export function getRun(id: string): Run {
  const entry = runs.get(id)
  if (!entry) throw new HttpError(404, 'Run not found.', 'not_found')
  return entry.run
}

export async function cancelRun(id: string): Promise<Run> {
  const entry = runs.get(id)
  if (!entry) throw new HttpError(404, 'Run not found.', 'not_found')
  if (entry.run.status === 'running' || entry.run.status === 'starting') {
    entry.run.status = 'cancelled'
    await entry.session?.cancel()
    entry.session?.close()
  }
  return entry.run
}

export function answerPermission(runId: string, permissionId: string, optionId: string | null): void {
  const entry = runs.get(runId)
  if (!entry?.session?.answerPermission(permissionId, optionId)) {
    throw new HttpError(404, 'No such pending permission.', 'not_found')
  }
}

/** A short round trip to check an agent works: it must answer a one-word prompt. Never touches files. */
export async function testAgent(
  agentId: string,
): Promise<{ ok: boolean; latencyMs: number; answer: string; error: string | null }> {
  const def = findAgent(agentId)
  if (!def) throw new HttpError(404, 'Unknown agent.', 'not_found')
  const { launch, env } = await launchFor(def)
  let answer = ''
  const session = new AgentSession(launch, env, (e) => e.kind === 'text' && (answer += e.text), 'reject')
  const started = Date.now()
  try {
    await session.start()
    await Promise.race([
      session.prompt(
        'This is a connection test from the Find Dreams app. Reply with the single word OK and nothing else. Do not use tools.',
      ),
      new Promise((_, fail) => setTimeout(() => fail(new Error('No answer in 120 s.')), 120_000).unref()),
    ])
    // it was asked for the single word OK: anything else (an adapter streams auth or billing errors as text) fails
    const ok = /^\W*ok\W*$/i.test(answer.trim())
    return {
      ok,
      latencyMs: Date.now() - started,
      answer: answer.trim().slice(0, 200),
      error: ok ? null : answer.trim().slice(0, 300) || 'No answer.',
    }
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, answer, error: e instanceof Error ? e.message : String(e) }
  } finally {
    session.close()
  }
}
