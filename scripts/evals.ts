/**
 * Product evals: does the AI behave like the agent kit says? Verifiable criteria from docs/PLAN.md, section 11.
 *
 *   npm run evals                          deterministic: the recorded outputs in evals/recorded (CI, verify)
 *   npm run evals -- --live [--brain auto|ollama|acp|api]
 *                                          live: scripted candidates against a real interview brain; transcripts
 *                                          go to evals/output/ (git-ignored), then the same checks run
 *
 * The recorded cases are real outputs (2026-11-19, Claude through ACP) for the fictional candidate in
 * evals/candidates — never a real person's data. A failing check names the case, the criterion and the evidence.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import {
  interviewFeedbackSchema,
  interviewSessionSchema,
  type InterviewFeedback,
  type InterviewSession,
} from '../shared/interview.js'
import type { InterviewType } from '../shared/interviewTypes.js'
import type { Language } from '../shared/languages.js'
import { profileSchema, type Profile } from '../shared/profile.js'
import { config } from '../server/config.js'

const EVALS = path.join(config.root, 'evals')

export interface Check {
  name: string
  ok: boolean
  evidence: string
}

const interviewerTurns = (s: InterviewSession) => s.turns.filter((t) => t.speaker === 'interviewer').map((t) => t.text)
const candidateTurns = (s: InterviewSession) => s.turns.filter((t) => t.speaker === 'candidate').map((t) => t.text)
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
const squash = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()

// ── criteria ─────────────────────────────────────────────────────────────────

const SALARY = /pretens[ãa]o|sal[áa]ri|faixa|remunera|salary|compensation|pay range|expectation/i

/** Money in the interviewer's words: confirming a range the candidate gave ("anotado, 14 a 18 mil reais"). */
const MONEY = /\breais\b|R\$|\bmil\b|thousand|\bk\b/i

/**
 * HR always covers the salary expectation (agent-kit interviewer/reference/hr_screening.md): it asks, or — when the
 * candidate offered a figure first — it confirms it.
 */
export function asksSalary(s: InterviewSession): Check {
  const hit = interviewerTurns(s).find((t) => SALARY.test(t) || MONEY.test(t))
  return {
    name: 'HR covered the salary expectation',
    ok: Boolean(hit),
    evidence: hit ?? 'no interviewer turn mentions salary',
  }
}

/** When the candidate dodges the salary question, the recruiter insists once (politely). */
export function insistsOnSalaryDodge(s: InterviewSession): Check {
  for (let i = 0; i < s.turns.length - 1; i++) {
    const turn = s.turns[i]!
    if (turn.speaker !== 'candidate') continue
    const dodge = /o que voc[eê]s acharem|whatever you think|negoci[áa]vel|open to/i.test(turn.text)
    if (dodge) {
      const next = s.turns[i + 1]!
      return { name: 'HR insisted after a salary dodge', ok: SALARY.test(next.text), evidence: next.text }
    }
  }
  return { name: 'HR insisted after a salary dodge', ok: true, evidence: '(no dodge in this transcript)' }
}

const PROBE =
  /exemplo|concret|por que|porqu|como |qual |quais|o que acontece|me conta|example|specific|why|how |what happens|walk me|tell me more/i

/** After a vague answer (short, no specifics), the technical interviewer digs one level deeper. */
export function probesAfterVague(s: InterviewSession, maxWords = 12): Check {
  const misses: string[] = []
  let vague = 0
  for (let i = 0; i < s.turns.length - 1; i++) {
    const turn = s.turns[i]!
    if (turn.speaker !== 'candidate' || words(turn.text) > maxWords) continue
    vague++
    const next = s.turns[i + 1]!
    if (!PROBE.test(next.text)) misses.push(`"${turn.text}" → "${next.text}"`)
  }
  return {
    name: 'probed after vague answers',
    ok: vague > 0 && misses.length === 0,
    evidence:
      vague === 0
        ? 'no vague answer to probe'
        : misses.length
          ? misses.join(' | ')
          : `${vague} vague answer(s), all probed`,
  }
}

/** Short turns, one question at a time (the conduct of every interviewer). */
export function oneQuestionAtATime(s: InterviewSession, maxQuestions = 2): Check {
  const crowded = interviewerTurns(s).filter((t) => (t.match(/\?/g)?.length ?? 0) > maxQuestions)
  return {
    name: 'one question at a time',
    ok: crowded.length === 0,
    evidence: crowded[0] ?? 'every turn has at most 2 questions',
  }
}

const MARKERS: Record<Language, RegExp> = {
  'pt-BR': /\b(você|não|que|uma|para)\b/i,
  en: /\b(you|the|and|your|what)\b/i,
}

/** The interviewer speaks the interview's language the whole time. */
export function staysInLanguage(s: InterviewSession): Check {
  const other: Language = s.language === 'en' ? 'pt-BR' : 'en'
  const off = interviewerTurns(s).filter((t) => !MARKERS[s.language].test(t) && MARKERS[other].test(t))
  return {
    name: `stayed in ${s.language}`,
    ok: off.length === 0,
    evidence: off[0] ?? 'all turns in the right language',
  }
}

/** Every stuck point quotes the transcript (a candidate turn), so the person sees exactly where. */
export function feedbackQuotesTranscript(s: InterviewSession, f: InterviewFeedback): Check {
  const said = candidateTurns(s).map(squash)
  const bad = f.stuckPoints.filter((p) => !said.some((t) => t.includes(squash(p.excerpt).replace(/^"|"$/g, ''))))
  return {
    name: 'feedback quotes the transcript',
    ok: f.stuckPoints.length > 0 && bad.length === 0,
    evidence: bad.length
      ? `not in the transcript: "${bad[0]!.excerpt}"`
      : `${f.stuckPoints.length} stuck point(s), all quoted`,
  }
}

/** Reply drafts: 2 or 3 options. */
export function draftCount(drafts: string): Check {
  const n = drafts.match(/^## /gm)?.length ?? 0
  return { name: '2 or 3 reply options', ok: n >= 2 && n <= 3, evidence: `${n} option(s)` }
}

/** "N years of X" in a draft: X must be in the CV or the profile's stack (no invented experience). */
export function noInventedExperience(drafts: string, cv: string, profile: Profile): Check {
  const known = squash(`${cv} ${profile.stack.map((s) => s.name).join(' ')} ${profile.headline}`)
  const claims = [
    ...drafts.matchAll(
      /(\d+)\+?\s*(?:anos|years)\s*(?:de|com|of|with|in|em)\s+(?:experi[êe]ncia\s+(?:com|em)\s+)?([A-Z][\w.+#-]*)/g,
    ),
  ]
  // the sentence's own punctuation is not part of the name ("5 anos de Node.js.")
  const invented = claims.filter((m) => !known.includes(m[2]!.replace(/[.,;:!?]+$/, '').toLowerCase()))
  return {
    name: 'no invented experience',
    ok: invented.length === 0,
    evidence: invented.length
      ? `claims "${invented[0]![0]}" but the CV does not show it`
      : `${claims.length} claim(s), all in the CV`,
  }
}

/** A salary figure in a draft comes from the profile's expectation (in thousands), never made up. */
export function salaryFromProfile(drafts: string, profile: Profile): Check {
  const exp = profile.salaryExpectation
  const figures = [...drafts.matchAll(/R\$\s*(\d{1,3})(?:[.,]?(\d{3}))?\s*(mil|k)?/gi)].map((m) =>
    m[2] ? Number(m[1]) * 1000 + Number(m[2]) : Number(m[1]) * (m[3] ? 1000 : 1),
  )
  if (!figures.length) return { name: 'salary from the profile', ok: true, evidence: '(no figure in the drafts)' }
  const allowed = new Set([exp?.min, exp?.max].filter((v): v is number => v !== undefined))
  const off = figures.filter((v) => !allowed.has(v))
  return {
    name: 'salary from the profile',
    ok: Boolean(exp) && off.length === 0,
    evidence: off.length
      ? `R$ ${off[0]} is not the profile's range`
      : `figures ${figures.join(', ')} match the profile`,
  }
}

// ── cases ────────────────────────────────────────────────────────────────────

const readJson = <T>(file: string, schema: z.ZodType<T>): T => schema.parse(JSON.parse(readFileSync(file, 'utf8')))

export function interviewChecks(type: InterviewType, s: InterviewSession, f?: InterviewFeedback): Check[] {
  const checks = [oneQuestionAtATime(s), staysInLanguage(s)]
  if (type === 'hr_screening') checks.push(asksSalary(s), insistsOnSalaryDodge(s))
  if (type === 'technical') checks.push(probesAfterVague(s))
  if (f) checks.push(feedbackQuotesTranscript(s, f))
  return checks
}

export function recordedCases(): Array<{ id: string; checks: Check[] }> {
  const candidate = path.join(EVALS, 'candidates', 'ana-backend')
  const profile = readJson(path.join(candidate, 'profile.json'), profileSchema)
  const cv = readFileSync(path.join(candidate, 'cv.md'), 'utf8')
  const cases: Array<{ id: string; checks: Check[] }> = []
  for (const id of ['hr-text-ptbr', 'technical-text-ptbr', 'hr-voice-ptbr', 'hr-voice-en']) {
    const dir = path.join(EVALS, 'recorded', id)
    const session = readJson(path.join(dir, 'transcript.json'), interviewSessionSchema)
    const feedback = existsSync(path.join(dir, 'feedback.json'))
      ? readJson(path.join(dir, 'feedback.json'), interviewFeedbackSchema)
      : undefined
    cases.push({ id, checks: interviewChecks(session.interviewType, session, feedback) })
  }
  const drafts = readFileSync(path.join(EVALS, 'recorded', 'reply-frontend', 'drafts.md'), 'utf8')
  cases.push({
    id: 'reply-frontend',
    checks: [draftCount(drafts), noInventedExperience(drafts, cv, profile), salaryFromProfile(drafts, profile)],
  })
  return cases
}

// ── live ─────────────────────────────────────────────────────────────────────

/** The scripted candidate: answers that test the conduct (a salary dodge in HR, vague answers in the technical). */
export const SCRIPTS: Record<'hr_screening' | 'technical', Record<Language, string[]>> = {
  hr_screening: {
    'pt-BR': [
      'Oi! Sou dev backend há 5 anos, trabalhei com a API de pagamentos da Exemplo Tech.',
      'Ah, salário... pode ser o que vocês acharem justo.',
      'Posso começar em 30 dias.',
    ],
    en: [
      'Hi! I am a backend developer with five years in payments.',
      'Salary... whatever you think is fair.',
      'I can start in thirty days.',
    ],
  },
  technical: {
    'pt-BR': ['Usamos microsserviços porque escala melhor.', 'Deu certo, funcionou bem.', 'Usávamos Postgres.'],
    en: ['We used microservices because it scales better.', 'It worked fine.', 'We used Postgres.'],
  },
}

async function live(brain: 'auto' | 'ollama' | 'acp' | 'api'): Promise<Array<{ id: string; checks: Check[] }>> {
  const workspace = mkdtempSync(path.join(tmpdir(), 'mzn-evals-'))
  config.workspaceFolder = workspace
  const slug = 'acme-pagamentos-backend-engineer-20261110'
  cpSync(path.join(config.root, 'test', 'fixtures', 'sample-workspace'), workspace, { recursive: true })
  const { setDb, openDb } = await import('../server/store/db.js')
  setDb(openDb(':memory:'))
  const { installKit } = await import('../server/agent/kit.js')
  installKit()
  // CI picks the API provider/model through the environment (the app keeps them as preferences)
  const { setPreference } = await import('../server/store/settings.js')
  if (process.env.MZN_EVAL_PROVIDER) setPreference('apiProvider', process.env.MZN_EVAL_PROVIDER)
  if (process.env.MZN_EVAL_MODEL) setPreference('apiModel', process.env.MZN_EVAL_MODEL)
  const { startInterview, candidateTurn, endInterview } = await import('../server/interview/sessions.js')
  const out = path.join(EVALS, 'output')
  mkdirSync(out, { recursive: true })
  const cases: Array<{ id: string; checks: Check[] }> = []
  for (const type of ['hr_screening', 'technical'] as const) {
    for (const language of ['pt-BR', 'en'] as const) {
      const first = await startInterview({ application: slug, interviewType: type, language, mode: 'text', brain })
      for (const answer of SCRIPTS[type][language]) await candidateTurn(first.id, answer)
      const { interviewFolder } = { interviewFolder: endInterview(first.id, language).folder }
      const file = path.join(workspace, 'applications', slug, 'interviews', interviewFolder, 'transcript.json')
      const session = readJson(file, interviewSessionSchema)
      const id = `live-${type}-${language}`
      writeFileSync(path.join(out, `${id}.json`), JSON.stringify(session, null, 2))
      cases.push({ id, checks: interviewChecks(type, session) })
    }
  }
  return cases
}

// ── main ─────────────────────────────────────────────────────────────────────

function report(cases: Array<{ id: string; checks: Check[] }>): number {
  let failed = 0
  for (const c of cases) {
    console.log(`\n${c.id}`)
    for (const check of c.checks) {
      if (!check.ok) failed++
      console.log(`  ${check.ok ? '[ok]  ' : '[FAIL]'} ${check.name} — ${check.evidence.slice(0, 160)}`)
    }
  }
  const total = cases.reduce((n, c) => n + c.checks.length, 0)
  console.log(`\n${total - failed}/${total} checks passed.`)
  return failed ? 1 : 0
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  if (args.includes('--live')) {
    const i = args.indexOf('--brain')
    const brain = z.enum(['auto', 'ollama', 'acp', 'api']).parse(i >= 0 ? args[i + 1] : 'auto')
    return report(await live(brain))
  }
  return report(recordedCases())
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    },
  )
}
