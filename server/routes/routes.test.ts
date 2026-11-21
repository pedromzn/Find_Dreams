import express from 'express'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../shared/zodPortuguese.js'
import { config } from '../config.js'
import { mountApi } from '../main.js'
import { openDb, setDb } from '../store/db.js'
import { workspacePath } from '../store/workspace.js'

const TOKEN = 'routes-token'
const ACME = 'acme-pagamentos-backend-engineer-20261110'
let server: Server
let base: string

async function call(method: string, route: string, body?: unknown) {
  const answer = await fetch(`${base}${route}`, {
    method,
    headers: { 'X-MZN-Token': TOKEN, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: answer.status, json: (await answer.json()) as { data?: any; error?: string; code?: string } }
}

beforeAll(async () => {
  rmSync(config.workspaceFolder, { recursive: true, force: true })
  cpSync(path.join(config.root, 'test', 'fixtures', 'sample-workspace'), config.workspaceFolder, { recursive: true })
  setDb(openDb(':memory:'))
  const app = mountApi(express(), TOKEN)
  server = await new Promise((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s))
  })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})

afterAll(async () => {
  setDb(null)
  server.closeAllConnections()
  await new Promise((ok) => server.close(ok))
})

describe('applications', () => {
  it('the detail brings every file of the folder, validated, and a timeline', async () => {
    const { status, json } = await call('GET', `/applications/${ACME}`)
    expect(status).toBe(200)
    const d = json.data
    expect(d.application.company).toBe('Acme Pagamentos')
    expect(d.job.problems).toEqual([])
    expect(d.company.content).toMatch(/example\.com/)
    expect(d.fit.score).toBe(78)
    expect(d.personas[0]).toMatchObject({ id: 'hr-screening', problems: [] })
    expect(d.interviews[0].feedback.scores[0].criterion).toBe('Communication')
    expect(d.debriefs[0].debrief.outcome).toBe('passed')
    expect(d.messages[0].name).toBe('2026-11-11-recruiter.md')
    const kinds = d.timeline.map((e: { kind: string }) => e.kind)
    expect(kinds).toEqual(expect.arrayContaining(['created', 'stage', 'next_step', 'message', 'simulation', 'debrief']))
    expect(d.timeline[0].at >= d.timeline.at(-1).at).toBe(true)
  })

  it('an unknown or malicious slug is a 404', async () => {
    expect((await call('GET', '/applications/nope-20260101')).status).toBe(404)
    expect((await call('GET', '/applications/..%2Fprofile')).status).toBe(404)
  })

  it('creates from the form, with job.md and a free slug', async () => {
    const form = {
      company: 'Globex',
      role: 'Frontend Developer',
      source: 'gupy',
      url: 'https://globex.gupy.io/jobs/42',
      workModel: 'hybrid',
      jobMarkdown: '# Frontend Developer\n\nReact and TypeScript.',
    }
    const one = await call('POST', '/applications', form)
    expect(one.status).toBe(201)
    expect(one.json.data).toMatchObject({ company: 'Globex', status: 'saved', stages: [] })
    const slug = one.json.data.slug as string
    expect(slug).toMatch(/^globex-frontend-developer-\d{8}$/)
    const job = readFileSync(workspacePath('applications', slug, 'job.md'), 'utf8')
    expect(job).toMatch(/^---\nsource: gupy\nurl: https:\/\/globex\.gupy\.io\/jobs\/42\ncapturedAt: /)
    expect((await call('GET', `/applications/${slug}`)).json.data.job.problems).toEqual([])
    const two = await call('POST', '/applications', form)
    expect(two.json.data.slug).toBe(`${slug}-2`)
    expect((await call('POST', '/applications', { company: 'X' })).status).toBe(422)
  })

  it('an edit merges only the sent fields and moves the status history', async () => {
    const before = (await call('GET', `/applications/${ACME}`)).json.data.application
    const edited = await call('PATCH', `/applications/${ACME}`, { status: 'offer', notes: 'Offer by phone' })
    expect(edited.status).toBe(200)
    expect(edited.json.data).toMatchObject({ status: 'offer', notes: 'Offer by phone', pros: before.pros })
    expect(edited.json.data.updatedAt > before.updatedAt).toBe(true)
    const timeline = (await call('GET', `/applications/${ACME}`)).json.data.timeline
    expect(timeline).toContainEqual(expect.objectContaining({ kind: 'status', label: 'offer', detail: 'interviewing' }))
    expect((await call('PATCH', `/applications/${ACME}`, { slug: 'other' })).status).toBe(422)
    expect((await call('PATCH', `/applications/${ACME}`, { status: 'nope' })).status).toBe(422)
  })

  it('saves a pasted message', async () => {
    const r = await call('POST', `/applications/${ACME}/messages`, { text: 'Can we talk tomorrow?' })
    expect(r.status).toBe(201)
    expect(r.json.data.name).toMatch(/^\d{4}-\d{2}-\d{2}-1\.md$/)
    expect((await call('POST', `/applications/${ACME}/messages`, { text: '' })).status).toBe(422)
  })

  it('metrics: response rate and time to first interview', async () => {
    const m = (await call('GET', '/metrics')).json.data
    expect(m.total).toBe(3)
    expect(m.byStatus.offer).toBe(1)
    expect(m.responseRate).toBe(1)
    expect(m.daysToFirstInterview).toBe(4)
  })

  it('delete moves the folder to the trash, recoverable', async () => {
    const list = (await call('GET', '/applications')).json.data as Array<{ slug: string }>
    const victim = list.find((a) => a.slug.startsWith('globex'))!.slug
    expect((await call('DELETE', `/applications/${victim}`)).status).toBe(200)
    expect(existsSync(workspacePath('applications', victim))).toBe(false)
    expect(readdirSync(workspacePath('.mzn', 'trash')).some((f) => f.startsWith(victim))).toBe(true)
    expect((await call('GET', '/applications')).json.data.some((a: { slug: string }) => a.slug === victim)).toBe(false)
  })
})

describe('profile and settings', () => {
  it('reads the profile and the CV', async () => {
    const { json } = await call('GET', '/profile')
    expect(json.data.profile.name).toBe('Ana Exemplo')
    expect(json.data.cv).toMatch(/^# Ana Exemplo/)
  })

  it('saves a valid profile and refuses an invalid one', async () => {
    expect((await call('PUT', '/profile', { name: 'Ana', stack: [] })).status).toBe(200)
    expect((await call('PUT', '/profile', { name: '' })).status).toBe(422)
    expect((await call('PUT', '/profile/cv', { markdown: '# Ana\n\nNew CV' })).status).toBe(200)
    expect(readFileSync(workspacePath('profile', 'cv.md'), 'utf8')).toBe('# Ana\n\nNew CV\n')
  })

  it('keeps the language in SQLite', async () => {
    expect((await call('GET', '/settings')).json.data.language).toBeNull()
    expect((await call('PUT', '/settings', { language: 'pt-BR' })).json.data.language).toBe('pt-BR')
    expect((await call('PUT', '/settings', { language: 'fr' })).status).toBe(422)
  })
})

describe('v2: overview, résumés, ATS, letters, discoveries', () => {
  it('the overview brings each application with its materials and scores', async () => {
    const { status, json } = await call('GET', '/overview')
    expect(status).toBe(200)
    const acme = json.data.applications.find((a: { slug: string }) => a.slug === ACME)
    expect(acme).toMatchObject({ fit: 78, hasResume: true, hasLetter: true, hasSalary: true, debriefs: 1 })
    expect(acme.ats).toBeGreaterThan(0)
    expect(json.data.hasCv).toBe(true)
    expect(json.data.hasBaseResume).toBe(true)
    expect(json.data.profileName).toMatch(/^Ana/)
    for (const e of json.data.recent) expect(e.at.slice(0, 10) <= new Date().toISOString().slice(0, 10)).toBe(true)
  })

  it('the detail brings the tailored résumé, the letter, the salary and the follow-ups', async () => {
    const d = (await call('GET', `/applications/${ACME}`)).json.data
    expect(d.resume.tailoring.application).toBe(ACME)
    expect(d.letter.problems).toEqual([])
    expect(d.salary.problems).toEqual([])
    expect(d.followUps).toHaveLength(1)
  })

  it('the ATS check reads the tailored résumé against the post', async () => {
    const { json } = await call('GET', `/applications/${ACME}/ats`)
    expect(json.data.basis).toBe('resume')
    expect(json.data.report.score).toBeGreaterThan(50)
    expect(json.data.report.keywords.length).toBeGreaterThan(0)
  })

  it('changes a résumé template, and refuses a path outside the résumé files', async () => {
    expect((await call('PUT', '/resumes/template', { file: 'profile/resume.json', template: 'harvard' })).status).toBe(
      200,
    )
    const list = (await call('GET', '/resumes')).json.data
    expect(list[0].resume.template).toBe('harvard')
    expect((await call('PUT', '/resumes/template', { file: 'profile/profile.json', template: 'harvard' })).status).toBe(
      422,
    )
  })

  it('saves an edited letter with valid front matter', async () => {
    const { status } = await call('PUT', `/applications/${ACME}/letter`, {
      body: 'Hello team,\n\nEdited.\n\nAna',
      tone: 'warm',
      language: 'en',
    })
    expect(status).toBe(200)
    const content = readFileSync(workspacePath('applications', ACME, 'cover-letter.md'), 'utf8')
    expect(content).toMatch(/^---\ntone: warm\n/)
    expect(content).toMatch(/Edited\./)
  })

  it('marks a discovered job as dismissed', async () => {
    expect((await call('PATCH', '/discoveries/2026-11-20.json/0', { status: 'dismissed' })).status).toBe(200)
    const files = (await call('GET', '/discoveries')).json.data
    expect(files[0].discovery.jobs[0].status).toBe('dismissed')
    expect((await call('PATCH', '/discoveries/../x.json/0', { status: 'saved' })).status).toBe(404)
  })

  it('keeps the theme preference', async () => {
    expect((await call('GET', '/settings')).json.data.theme).toBe('system')
    expect((await call('PUT', '/settings', { theme: 'light' })).json.data.theme).toBe('light')
    expect((await call('PUT', '/settings', { theme: 'neon' })).status).toBe(422)
  })
})
