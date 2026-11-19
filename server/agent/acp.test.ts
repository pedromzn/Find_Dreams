import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../config.js'
import { openDb, setDb } from '../store/db.js'
import { workspacePath } from '../store/workspace.js'
import { AgentSession, insideWorkspace, type AgentEvent } from './acp.js'
import { AGENTS, detectAll } from './registry.js'
import { createRequest } from './requests.js'
import { answerPermission, cancelRun, getRun, startRun, testAgent, type Run } from './runner.js'
import { setShellPathForTests, which } from './shellPath.js'

const FAKE = path.join(config.root, 'test', 'fixtures', 'fake-acp-agent.mjs')
const launch = { command: process.execPath, args: [FAKE] }

beforeAll(() => {
  setDb(openDb(':memory:'))
  setShellPathForTests(path.dirname(process.execPath))
  AGENTS.push({
    id: 'fake',
    name: 'Fake',
    detect: path.basename(process.execPath),
    command: 'node',
    args: [FAKE],
    install: '',
    login: '',
  })
})

afterAll(() => {
  AGENTS.splice(
    AGENTS.findIndex((a) => a.id === 'fake'),
    1,
  )
  setShellPathForTests(null)
  setDb(null)
})

beforeEach(() => {
  rmSync(config.workspaceFolder, { recursive: true, force: true })
  rmSync(path.join(config.workspaceFolder, '..', 'escape.md'), { force: true })
})

async function until<T>(f: () => T | undefined | null | false, ms = 10_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = f()
    if (v) return v
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 25))
  }
}

describe('the ACP client against a real subprocess', () => {
  it('initializes, prompts, streams text and tool calls, asks permission and writes inside the workspace', async () => {
    const events: AgentEvent[] = []
    let session!: AgentSession
    session = new AgentSession(launch, process.env, (e) => {
      events.push(e)
      if (e.kind === 'permission') session.answerPermission(e.id, 'yes')
    })
    await session.start()
    expect(await session.prompt('Analyze the fit')).toBe('end_turn')
    session.close()
    expect(
      events
        .filter((e) => e.kind === 'text')
        .map((e) => (e as { text: string }).text)
        .join(''),
    ).toBe('Working on it. Done.')
    expect(events).toContainEqual(expect.objectContaining({ kind: 'tool', id: 't1', status: 'completed' }))
    expect(readFileSync(workspacePath('fake-agent-was-here.md'), 'utf8')).toMatch(/Analyze the fit/)
    // the fake tried to write ../escape.md: refused
    expect(existsSync(path.join(config.workspaceFolder, '..', 'escape.md'))).toBe(false)
  })

  it('a refused permission means nothing is written', async () => {
    let session!: AgentSession
    session = new AgentSession(
      launch,
      process.env,
      (e) => e.kind === 'permission' && session.answerPermission(e.id, null),
    )
    await session.start()
    await session.prompt('x')
    session.close()
    expect(existsSync(workspacePath('fake-agent-was-here.md'))).toBe(false)
  })

  it('a crashing agent fails with its stderr, not a hang', async () => {
    const session = new AgentSession(launch, { ...process.env, FAKE_AGENT_MODE: 'crash' }, () => undefined)
    await expect(session.start()).rejects.toThrow(/exited \(code 3\).*crashing on purpose/)
    session.close()
  })

  it('the file guard: only inside the workspace, never .mzn', () => {
    expect(insideWorkspace('applications/x/fit.json')).toBe(
      path.join(config.workspaceFolder, 'applications/x/fit.json'),
    )
    expect(() => insideWorkspace('../outside.txt')).toThrow()
    expect(() => insideWorkspace('/etc/passwd')).toThrow()
    expect(() => insideWorkspace('.mzn/session.json')).toThrow()
  })
})

describe('runs', () => {
  it('a request runs end to end with the selected agent, with the permission answered from the page', async () => {
    const request = createRequest({ task: 'analyze-fit', language: 'en' })
    const run = await startRun(request.id, 'fake')
    const pending = await until(() => getRun(run.id).permissions[0])
    answerPermission(run.id, pending.id, 'yes')
    const finished = await until(() => (['done', 'failed'].includes(getRun(run.id).status) ? getRun(run.id) : null))
    expect(finished).toMatchObject<Partial<Run>>({ status: 'done', error: null })
    expect(finished.text).toBe('Working on it. Done.')
    expect(JSON.parse(readFileSync(workspacePath('requests', `${request.id}.json`), 'utf8')).status).toBe('done')
  })

  it('a run can be cancelled', async () => {
    process.env.FAKE_AGENT_MODE = 'slow'
    try {
      const request = createRequest({ task: 'analyze-fit', language: 'en' })
      const run = await startRun(request.id, 'fake')
      await until(() => getRun(run.id).status === 'running')
      await cancelRun(run.id)
      expect(getRun(run.id).status).toBe('cancelled')
    } finally {
      delete process.env.FAKE_AGENT_MODE
    }
  })

  it('a connection test only passes on the word OK (adapters stream billing errors as text)', async () => {
    process.env.FAKE_AGENT_MODE = 'error-text'
    try {
      const failed = await testAgent('fake')
      expect(failed).toMatchObject({ ok: false })
      expect(failed.error).toMatch(/402 Payment Required/)
    } finally {
      delete process.env.FAKE_AGENT_MODE
    }
  })

  it('the connection test', async () => {
    const result = await testAgent('fake')
    expect(result).toMatchObject({ ok: true, answer: 'OK', error: null })
  })

  it('detection finds what is on the PATH and reports the rest as missing', async () => {
    expect(await which(path.basename(process.execPath))).toBe(process.execPath)
    const agents = await detectAll(() => false)
    expect(agents.find((a) => a.id === 'fake')).toMatchObject({ installed: true, via: 'native' })
    expect(agents.find((a) => a.id === 'gemini')).toMatchObject({ installed: false, via: null })
    // Claude runs on the person's own `claude` CLI: missing from this test PATH, so it is reported
    expect(agents.find((a) => a.id === 'claude')).toMatchObject({ needsSecret: 'claude', usesPlanLimits: true })
  })
})
