import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import express from 'express'
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../config.js'
import { mountApi } from '../main.js'
import { openDb, setDb } from '../store/db.js'
import { workspacePath } from '../store/workspace.js'
import { installKit, kitFiles, kitStatus, resolveConflict, writeSession } from './kit.js'
import { createRequest, promptFor } from './requests.js'

const run = promisify(execFile)
const TOKEN = 'agent-token'
const ACME = 'acme-pagamentos-backend-engineer-20261110'
let server: Server
let port: number

function freshWorkspace() {
  rmSync(config.workspaceFolder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  cpSync(path.join(config.root, 'test', 'fixtures', 'sample-workspace'), config.workspaceFolder, { recursive: true })
}

beforeAll(async () => {
  setDb(openDb(':memory:'))
  server = await new Promise((ok) => {
    const s = mountApi(express(), TOKEN).listen(0, '127.0.0.1', () => ok(s))
  })
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  setDb(null)
  server.closeAllConnections()
  await new Promise((ok) => server.close(ok))
})

beforeEach(freshWorkspace)

describe('the agent kit in the workspace', () => {
  it('installs every file, the schemas and a manifest', () => {
    const status = installKit()
    expect(status.conflicts).toEqual([])
    for (const file of kitFiles()) expect(existsSync(workspacePath(file))).toBe(true)
    expect(kitFiles()).toContain('.claude/skills/analyze-fit/SKILL.md')
    expect(existsSync(workspacePath('.mzn', 'schemas', 'fit.schema.json'))).toBe(true)
    expect(kitStatus().installed).toBe(status.version)
  })

  it('updates untouched files and keeps edited ones, offering the new version', () => {
    installKit()
    const manifest = JSON.parse(readFileSync(workspacePath('.mzn', 'agent-kit.json'), 'utf8'))
    // pretend the app shipped an older AGENTS.md and CLAUDE.md last time
    writeFileSync(workspacePath('AGENTS.md'), 'old manual')
    writeFileSync(workspacePath('CLAUDE.md'), 'old claude')
    manifest.files['AGENTS.md'] = createHash('sha256').update('old manual').digest('hex')
    manifest.files['CLAUDE.md'] = 'hash of something else: the person edited it'
    writeFileSync(workspacePath('.mzn', 'agent-kit.json'), JSON.stringify(manifest))

    const status = installKit()
    expect(readFileSync(workspacePath('AGENTS.md'), 'utf8')).toMatch(/your manual in this folder/)
    expect(readFileSync(workspacePath('CLAUDE.md'), 'utf8')).toBe('old claude')
    expect(existsSync(workspacePath('CLAUDE.md.new'))).toBe(true)
    expect(status.conflicts).toEqual(['CLAUDE.md'])

    expect(resolveConflict('CLAUDE.md', 'keep').conflicts).toEqual([])
    expect(readFileSync(workspacePath('CLAUDE.md'), 'utf8')).toBe('old claude')
    expect(existsSync(workspacePath('CLAUDE.md.new'))).toBe(false)
    // kept on purpose: the next install does not complain again
    expect(installKit().conflicts).toEqual([])
  })

  it('replacing takes the new version', () => {
    installKit()
    writeFileSync(workspacePath('AGENTS.md'), 'my own notes')
    expect(installKit().conflicts).toEqual(['AGENTS.md'])
    resolveConflict('AGENTS.md', 'replace')
    expect(readFileSync(workspacePath('AGENTS.md'), 'utf8')).toMatch(/your manual in this folder/)
  })
})

describe('requests', () => {
  it('writes a valid request file and a prompt in the request language', () => {
    const r = createRequest(
      { task: 'analyze-fit', application: ACME, language: 'pt-BR' },
      new Date(2026, 10, 19, 10, 0, 0),
    )
    expect(r.id).toBe('20261119-100000-analyze-fit')
    const file = workspacePath('requests', `${r.id}.json`)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ task: 'analyze-fit', status: 'pending' })
    const { prompt, folder } = promptFor(r)
    expect(prompt).toMatch(/^Leia o AGENTS\.md/)
    expect(prompt).toContain(`requests/${r.id}.json`)
    expect(prompt).toContain('.claude/skills/analyze-fit/SKILL.md')
    expect(folder).toBe(config.workspaceFolder)
    const twin = createRequest(
      { task: 'analyze-fit', application: ACME, language: 'en' },
      new Date(2026, 10, 19, 10, 0, 0),
    )
    expect(twin.id).toBe('20261119-100000-analyze-fit-2')
    expect(() => createRequest({ task: 'analyze-fit', application: '../x', language: 'en' })).toThrow()
  })

  it('over HTTP, and listed', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/requests`, {
      method: 'POST',
      headers: { 'X-MZN-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'research-company', application: ACME, language: 'en' }),
    })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.prompt).toMatch(/^Read AGENTS\.md/)
    const list = await (
      await fetch(`http://127.0.0.1:${port}/api/requests`, { headers: { 'X-MZN-Token': TOKEN } })
    ).json()
    expect(list.data[0].request.task).toBe('research-company')
  })
})

describe('the AI validator (.mzn/validate.mjs)', () => {
  it('validates through the running app and exits 1 on problems', async () => {
    installKit()
    writeSession(port, TOKEN)
    const fit = workspacePath('applications', ACME, 'fit.json')
    const ok = await run(process.execPath, ['.mzn/validate.mjs', `applications/${ACME}/fit.json`], {
      cwd: config.workspaceFolder,
    })
    expect(ok.stdout).toMatch(/\[ok\]\s+applications\/.*fit\.json/)

    writeFileSync(fit, JSON.stringify({ ...JSON.parse(readFileSync(fit, 'utf8')), score: 140 }))
    const bad = await run(process.execPath, [workspacePath('.mzn', 'validate.mjs'), fit], { cwd: tmpdir() }).catch(
      (e) => e,
    )
    expect(bad.code).toBe(1)
    expect(bad.stdout).toMatch(/score: /)

    const all = await run(process.execPath, ['.mzn/validate.mjs', '--all'], { cwd: config.workspaceFolder }).catch(
      (e) => e,
    )
    expect(all.stdout).toMatch(/problem\(s\)/)
  })

  it('says the app is not running when there is no session', async () => {
    installKit()
    writeSession(port, TOKEN)
    rmSync(workspacePath('.mzn', 'session.json'))
    const r = await run(process.execPath, ['.mzn/validate.mjs', 'x.json'], { cwd: config.workspaceFolder }).catch(
      (e) => e,
    )
    expect(r.code).toBe(2)
    expect(r.stderr).toMatch(/not running/)
  })

  it('reply drafts need 2 or 3 options', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/validate`, {
      method: 'POST',
      headers: { 'X-MZN-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [`applications/${ACME}/messages/2026-11-11-recruiter.drafts.md`] }),
    })
    expect((await res.json()).data[0].problems).toEqual(['File not found.'])
    writeFileSync(workspacePath('applications', ACME, 'messages', '2026-11-11-recruiter.drafts.md'), '## One\n\nHi')
    const again = await fetch(`http://127.0.0.1:${port}/api/validate`, {
      method: 'POST',
      headers: { 'X-MZN-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [`applications/${ACME}/messages/2026-11-11-recruiter.drafts.md`] }),
    })
    expect((await again.json()).data[0].problems[0]).toMatch(/2 or 3 reply options/)
  })
})

describe('the event stream', () => {
  it('takes the token in the query string, and only there', async () => {
    const without = await fetch(`http://127.0.0.1:${port}/api/events`)
    expect(without.status).toBe(401)
    const controller = new AbortController()
    const withToken = await fetch(`http://127.0.0.1:${port}/api/events?token=${TOKEN}`, { signal: controller.signal })
    expect(withToken.status).toBe(200)
    expect(withToken.headers.get('content-type')).toMatch(/text\/event-stream/)
    controller.abort()
    const elsewhere = await fetch(`http://127.0.0.1:${port}/api/health?token=${TOKEN}`)
    expect(elsewhere.status).toBe(401)
  })
})
