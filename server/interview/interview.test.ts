import express from 'express'
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { BrainReply } from '../../shared/interview.js'
import { validateFile } from '../../shared/workspace.js'
import { config } from '../config.js'
import { mountApi } from '../main.js'
import { secrets } from '../secrets.js'
import { openDb, setDb } from '../store/db.js'
import { setPreference } from '../store/settings.js'
import { workspacePath } from '../store/workspace.js'
import { installKit } from '../agent/kit.js'
import { AGENTS } from '../agent/registry.js'
import { setShellPathForTests } from '../agent/shellPath.js'
import { acpBrain, apiBrain, chooseModel, ollamaBrain, parseReply, type InterviewBrain } from './brains.js'
import { chatMessages, defaultPersona, systemPrompt } from './context.js'
import { candidateTurn, endInterview, startInterview, closeAllInterviews } from './sessions.js'

const ACME = 'acme-pagamentos-backend-engineer-20261110'
const FAKE = path.join(config.root, 'test', 'fixtures', 'fake-acp-agent.mjs')

/** A brain that follows a script and records what it was given. */
function scripted(replies: BrainReply[]): InterviewBrain & { seen: Array<{ system: string; last: string }> } {
  const seen: Array<{ system: string; last: string }> = []
  let i = 0
  return {
    engine: 'ollama',
    seen,
    async reply(system, messages) {
      seen.push({ system, last: messages.at(-1)!.content })
      return replies[Math.min(i++, replies.length - 1)]!
    },
    close() {},
  }
}

function fakeFetch(answer: unknown, status = 200, capture?: { url?: string; body?: any; headers?: any }): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    if (capture) {
      capture.url = url
      capture.body = JSON.parse(String(init.body))
      capture.headers = init.headers
    }
    return new Response(JSON.stringify(answer), { status })
  }) as unknown as typeof fetch
}

beforeAll(() => {
  setDb(openDb(':memory:'))
})
afterAll(() => {
  closeAllInterviews()
  setDb(null)
})
beforeEach(() => {
  rmSync(config.workspaceFolder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  cpSync(path.join(config.root, 'test', 'fixtures', 'sample-workspace'), config.workspaceFolder, { recursive: true })
  installKit()
})

describe('the brain answer', () => {
  it('parses JSON, also wrapped in prose, a code fence or a think block', () => {
    expect(parseReply('{"say":"Hi","intent":"probe"}')).toEqual({ say: 'Hi', intent: 'probe', notes: '' })
    expect(parseReply('Sure!\n```json\n{"say":"Hi","intent":"end","notes":"x"}\n```').intent).toBe('end')
    expect(parseReply('<think>hmm {not this}</think>{"say":"Ok","intent":"next_topic"}').say).toBe('Ok')
  })

  it('keeps the conversation going when the model ignored the format', () => {
    expect(parseReply('Tell me about yourself.')).toEqual({
      say: 'Tell me about yourself.',
      intent: 'probe',
      notes: '',
    })
    expect(() => parseReply('{"say": "", "intent": "probe"}')).toThrow()
  })

  it('picks the Ollama model: the setting, else the preferred list, never an embedding model', () => {
    expect(chooseModel(['nomic-embed-text', 'qwen3:4b'], null)).toBe('qwen3:4b')
    expect(chooseModel(['nomic-embed-text', 'mistral:7b'], null)).toBe('mistral:7b')
    expect(chooseModel(['llama3.1:8b'], 'qwen3:8b')).toBeNull()
  })
})

describe('the context', () => {
  it('carries the conduct, the persona, the job and the CV as data, and the JSON contract', () => {
    const persona = defaultPersona('hr_screening', 'pt-BR')
    const system = systemPrompt(ACME, persona, 'pt-BR')
    expect(system).toMatch(/^MZN-INTERVIEWER/)
    expect(system).toContain('Português (Brasil)')
    expect(system).toContain('One question at a time')
    expect(system).toContain('Always ask the salary expectation')
    expect(system).toContain('# Backend Engineer — Acme Pagamentos')
    expect(system).toContain('# Ana Exemplo')
    expect(persona.likelyQuestions.length).toBeGreaterThan(2)
  })

  it('the transcript becomes chat messages, ending on the candidate', () => {
    const m = chatMessages({
      application: ACME,
      interviewType: 'technical',
      persona: 'p',
      language: 'en',
      mode: 'text',
      brain: 'ollama',
      turns: [{ speaker: 'interviewer', text: 'Hi', ts: '2026-11-19T10:00:00Z' }],
      startedAt: '2026-11-19T10:00:00Z',
      status: 'in_progress',
    })
    expect(m.map((x) => x.role)).toEqual(['assistant', 'user'])
  })
})

describe('the brains', () => {
  it('Ollama: JSON schema format and no thinking for qwen3', async () => {
    const seen: { body?: any } = {}
    const brain = ollamaBrain(
      'qwen3:8b',
      fakeFetch({ message: { content: '{"say":"Olá","intent":"probe"}' } }, 200, seen),
    )
    expect(await brain.reply('sys', [{ role: 'user', content: 'oi' }])).toMatchObject({ say: 'Olá' })
    expect(seen.body).toMatchObject({ model: 'qwen3:8b', think: false, stream: false })
    expect(seen.body.format.properties.intent.enum).toContain('end')
    expect(seen.body.messages[0]).toEqual({ role: 'system', content: 'sys' })
  })

  it('API: Anthropic with the key from the secret store, never from the page', async () => {
    secrets.set('ANTHROPIC_API_KEY', 'sk-test')
    const seen: { url?: string; body?: any; headers?: any } = {}
    const brain = apiBrain(
      'anthropic',
      'claude-haiku-5-5',
      fakeFetch({ content: [{ type: 'text', text: '{"say":"Hello","intent":"probe"}' }] }, 200, seen),
    )
    expect((await brain.reply('sys', [{ role: 'user', content: 'hi' }])).say).toBe('Hello')
    expect(seen.url).toBe('https://api.anthropic.com/v1/messages')
    expect(seen.headers['x-api-key']).toBe('sk-test')
    expect(seen.body).toMatchObject({ model: 'claude-haiku-5-5', system: 'sys' })
    secrets.set('ANTHROPIC_API_KEY', null)
    expect(() => apiBrain('anthropic', 'm')).toThrow(/API key/)
  })

  it('API: OpenAI-compatible endpoint, errors surface', async () => {
    secrets.set('OPENAI_API_KEY', 'sk-o')
    setPreference('openaiBaseUrl', 'https://llm.example.com/v1')
    const seen: { url?: string } = {}
    const ok = apiBrain(
      'openai',
      'some-model',
      fakeFetch({ choices: [{ message: { content: '{"say":"Yo","intent":"probe"}' } }] }, 200, seen),
    )
    expect((await ok.reply('s', [{ role: 'user', content: 'x' }])).say).toBe('Yo')
    expect(seen.url).toBe('https://llm.example.com/v1/chat/completions')
    const bad = apiBrain('openai', 'some-model', fakeFetch({ error: { message: 'quota' } }, 429))
    await expect(bad.reply('s', [{ role: 'user', content: 'x' }])).rejects.toThrow('quota')
    secrets.set('OPENAI_API_KEY', null)
  })

  it('ACP: the agent as interviewer, one session for the whole interview', async () => {
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
    try {
      const brain = await acpBrain('fake')
      const first = await brain.reply('MZN-INTERVIEWER system', [
        { role: 'user', content: '(the candidate joins the call)' },
      ])
      expect(first).toMatchObject({ say: 'Hi! Tell me about yourself.', intent: 'probe' })
      const second = await brain.reply('ignored', [{ role: 'user', content: 'I build APIs.' }])
      expect(second.say).toBe('Can you give a concrete example?')
      brain.close()
    } finally {
      AGENTS.splice(
        AGENTS.findIndex((a) => a.id === 'fake'),
        1,
      )
      setShellPathForTests(null)
    }
  })
})

describe('a practice interview', () => {
  it('runs turn by turn, writes a valid transcript after every turn, and hands the feedback to the agent', async () => {
    const brain = scripted([
      { say: 'Olá! Me conta um pouco sobre você.', intent: 'probe', notes: '' },
      { say: 'Qual sua pretensão salarial?', intent: 'next_topic', notes: '' },
      { say: 'Obrigada, é isso por hoje.', intent: 'end', notes: '' },
    ])
    const open = await startInterview(
      { application: ACME, interviewType: 'hr_screening', language: 'pt-BR', mode: 'text', brain: 'auto' },
      async () => brain,
    )
    expect(open).toMatchObject({ say: 'Olá! Me conta um pouco sobre você.', personaPrepared: false })
    // the fixture already has a 2026-11-12 HR folder; today's gets today's date (and a suffix only if it exists)
    const file = `applications/${ACME}/interviews/${open.folder}/transcript.json`
    expect(validateFile(file, readFileSync(workspacePath(file), 'utf8'))).toEqual([])

    const next = await candidateTurn(open.id, 'Sou dev backend há 5 anos.')
    expect(next.say).toBe('Qual sua pretensão salarial?')
    expect(brain.seen[1]!.last).toBe('Sou dev backend há 5 anos.')
    const transcript = JSON.parse(readFileSync(workspacePath(file), 'utf8'))
    expect(transcript.turns.map((t: { speaker: string }) => t.speaker)).toEqual([
      'interviewer',
      'candidate',
      'interviewer',
    ])

    const done = endInterview(open.id, 'pt-BR')
    expect(done.request).toMatchObject({
      task: 'interview-feedback',
      file: `interviews/${open.folder}/transcript.json`,
    })
    expect(JSON.parse(readFileSync(workspacePath(file), 'utf8')).status).toBe('completed')
    await expect(candidateTurn(open.id, 'oi')).rejects.toMatchObject({ status: 404 })
  })

  it('uses a prepared persona when asked, and a second interview the same day gets its own folder', async () => {
    const make = () =>
      startInterview(
        {
          application: ACME,
          interviewType: 'hr_screening',
          persona: 'hr-screening',
          language: 'en',
          mode: 'text',
          brain: 'auto',
        },
        async () => scripted([{ say: 'Hi', intent: 'probe', notes: '' }]),
      )
    const a = await make()
    const b = await make()
    expect(a.personaPrepared).toBe(true)
    expect(b.folder).toBe(`${a.folder}-2`)
    expect(existsSync(workspacePath('applications', ACME, 'interviews', b.folder, 'transcript.json'))).toBe(true)
    await expect(
      startInterview(
        { application: ACME, interviewType: 'technical', persona: 'nope', language: 'en', mode: 'text', brain: 'auto' },
        async () => scripted([]),
      ),
    ).rejects.toMatchObject({ code: 'invalid_file' })
  })
})

describe('debriefs over HTTP', () => {
  let server: Server
  let base: string
  beforeAll(async () => {
    server = await new Promise((ok) => {
      const s = mountApi(express(), 't').listen(0, '127.0.0.1', () => ok(s))
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  })
  afterAll(async () => {
    server.closeAllConnections()
    await new Promise((ok) => server.close(ok))
  })

  it("saves the person's account and asks the agent for the analysis", async () => {
    const res = await fetch(`${base}/applications/${ACME}/debriefs`, {
      method: 'POST',
      headers: { 'X-MZN-Token': 't', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-11-20',
        interviewType: 'technical',
        account: 'They asked about the ledger and idempotency. I hesitated on sharding.',
        questionsAsked: ['How would you shard the ledger?'],
        selfAssessment: 'mixed',
        language: 'en',
      }),
    })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.name).toBe('2026-11-20-technical')
    expect(data.request).toMatchObject({ task: 'debrief', file: 'debriefs/2026-11-20-technical.json' })
    const file = `applications/${ACME}/debriefs/2026-11-20-technical.json`
    expect(validateFile(file, readFileSync(workspacePath(file), 'utf8'))).toEqual([])
  })
})
