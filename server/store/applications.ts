/**
 * Applications as the app sees them: the detail screen (every file of the folder, each validated), creation from the
 * "New application" form, edits, the timeline and the board's metrics.
 *
 * The AI writes most of these files directly; the app only writes `application.json` (forms), `job.md` (capture),
 * messages the person pastes and, later, interview transcripts. Reads never throw on a broken file: the problem goes
 * to the screen, so the person (or the AI) can fix it.
 */

import { existsSync, readdirSync, readFileSync, renameSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import type {
  ApplicationDetail,
  DebriefSummary,
  InterviewSummary,
  MarkdownFile,
  DiscoveryFile,
  Metrics,
  Overview,
  OverviewApplication,
  PersonaSummary,
  ResumeFile,
  TimelineEvent,
} from '../../shared/api.js'
import {
  applicationPatchSchema,
  applicationSlug,
  CLOSED_STATUSES,
  newApplicationSchema,
  STATUSES,
  type Application,
  type ApplicationPatch,
  type NewApplication,
  type Status,
} from '../../shared/application.js'
import { fitSchema, type Fit } from '../../shared/fit.js'
import {
  debriefSchema,
  interviewerPersonaSchema,
  interviewFeedbackSchema,
  interviewSessionSchema,
} from '../../shared/interview.js'
import { readFrontMatter, validateFile } from '../../shared/workspace.js'
import { resumeChecks, resumeSchema, resumeText, type Resume } from '../../shared/resume.js'
import { atsReport } from '../../shared/ats.js'
import { discoverySchema, type Discovery } from '../../shared/discovery.js'
import { HttpError } from '../errors.js'
import { statusHistory } from './applicationIndex.js'
import {
  readApplication,
  readApplications,
  validSlug,
  workspacePath,
  writeApplication,
  writeFileAtomic,
} from './workspace.js'
import type { z } from 'zod'

// ── reading ──────────────────────────────────────────────────────────────────

function readText(relative: string): string | null {
  try {
    return readFileSync(workspacePath(relative), 'utf8')
  } catch {
    return null
  }
}

/** Reads and validates one JSON file; `null` data when missing or invalid (the problems say which). */
function readJson<T>(relative: string, schema: z.ZodType<T>): { data: T | null; problems: string[]; exists: boolean } {
  const content = readText(relative)
  if (content === null) return { data: null, problems: [], exists: false }
  const problems = validateFile(relative, content) ?? []
  if (problems.length) return { data: null, problems, exists: true }
  return { data: schema.parse(JSON.parse(content)), problems: [], exists: true }
}

function readMarkdown(relative: string): MarkdownFile | null {
  const content = readText(relative)
  if (content === null) return null
  return { name: path.posix.basename(relative), content, problems: validateFile(relative, content) ?? [] }
}

function entries(relative: string, kind: 'dirs' | 'files', extension = ''): string[] {
  const folder = workspacePath(relative)
  if (!existsSync(folder)) return []
  return readdirSync(folder, { withFileTypes: true })
    .filter(
      (e) => !e.isSymbolicLink() && (kind === 'dirs' ? e.isDirectory() : e.isFile() && e.name.endsWith(extension)),
    )
    .map((e) => e.name)
    .sort()
}

function requireSlug(slug: string): void {
  if (!validSlug(slug) || !existsSync(workspacePath('applications', slug))) {
    throw new HttpError(404, 'Application not found.', 'not_found')
  }
}

export function applicationDetail(slug: string): ApplicationDetail {
  requireSlug(slug)
  const base = `applications/${slug}`
  const read = readApplication(slug)!
  const fit = readJson<Fit>(`${base}/fit.json`, fitSchema)

  const personas: PersonaSummary[] = entries(`${base}/interviewers`, 'files', '.json').map((file) => {
    const r = readJson(`${base}/interviewers/${file}`, interviewerPersonaSchema)
    return { id: file.slice(0, -5), persona: r.data, problems: r.problems }
  })

  const interviews: InterviewSummary[] = entries(`${base}/interviews`, 'dirs').map((id) => {
    const session = readJson(`${base}/interviews/${id}/transcript.json`, interviewSessionSchema)
    const feedback = readJson(`${base}/interviews/${id}/feedback.json`, interviewFeedbackSchema)
    return { id, session: session.data, feedback: feedback.data, problems: [...session.problems, ...feedback.problems] }
  })

  const debriefs: DebriefSummary[] = entries(`${base}/debriefs`, 'files', '.json').map((file) => {
    const r = readJson(`${base}/debriefs/${file}`, debriefSchema)
    return { id: file.slice(0, -5), debrief: r.data, problems: r.problems }
  })

  const messages = entries(`${base}/messages`, 'files', '.md')
    .filter((file) => !file.endsWith('.drafts.md'))
    .map((file) => readMarkdown(`${base}/messages/${file}`))
    .filter((m): m is MarkdownFile => m !== null)
    .map((m) => ({ ...m, drafts: readMarkdown(`${base}/messages/${m.name.slice(0, -3)}.drafts.md`) }))

  const resume = readJson<Resume>(`${base}/resume.json`, resumeSchema)
  const followUps = entries(`${base}/follow-ups`, 'files', '.md')
    .map((file) => readMarkdown(`${base}/follow-ups/${file}`))
    .filter((m): m is MarkdownFile => m !== null)

  const detail: ApplicationDetail = {
    slug,
    application: read.application,
    problems: read.problems,
    job: readMarkdown(`${base}/job.md`),
    company: readMarkdown(`${base}/company.md`),
    fit: fit.data,
    fitProblems: fit.problems,
    personas,
    interviews,
    debriefs,
    messages,
    resume: resume.data,
    resumeProblems: resume.problems,
    letter: readMarkdown(`${base}/cover-letter.md`),
    salary: readMarkdown(`${base}/salary.md`),
    followUps,
    timeline: [],
  }
  detail.timeline = timeline(detail)
  return detail
}

/** Everything that happened, newest first: status changes, stages, steps, messages, simulations and debriefs. */
export function timeline(detail: Omit<ApplicationDetail, 'timeline'>): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const a = detail.application
  if (a) events.push({ at: a.createdAt, kind: 'created', label: a.company })
  for (const change of statusHistory(detail.slug)) {
    if (change.from !== null) events.push({ at: change.at, kind: 'status', label: change.to, detail: change.from })
  }
  for (const stage of a?.stages ?? []) {
    if (stage.date) events.push({ at: stage.date, kind: 'stage', label: stage.type, detail: stage.result })
  }
  for (const step of a?.nextSteps ?? []) {
    if (step.due)
      events.push({ at: step.due, kind: 'next_step', label: step.what, detail: step.done ? 'done' : 'open' })
  }
  for (const m of detail.messages) {
    const date = /^\d{4}-\d{2}-\d{2}/.exec(m.name)?.[0]
    if (date) events.push({ at: date, kind: 'message', label: m.name })
  }
  for (const i of detail.interviews) {
    events.push({ at: i.session?.startedAt ?? i.id.slice(0, 10), kind: 'simulation', label: i.id.slice(11) })
  }
  for (const d of detail.debriefs) {
    events.push({ at: d.debrief?.date ?? d.id.slice(0, 10), kind: 'debrief', label: d.id.slice(11) })
  }
  return events.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
}

// ── writing ──────────────────────────────────────────────────────────────────

/** The `job.md` front matter the validator expects, then the post. */
export function jobMarkdown(source: string, url: string | undefined, capturedAt: string, body: string): string {
  const front = [`source: ${source}`, ...(url ? [`url: ${url}`] : []), `capturedAt: ${capturedAt}`]
  return `---\n${front.join('\n')}\n---\n\n${body.trim()}\n`
}

/** `acme-dev-20261119`, or `-2`, `-3`… when that folder already exists (two applications to one company a day). */
function freeSlug(base: string): string {
  let slug = base
  for (let n = 2; existsSync(workspacePath('applications', slug)); n++) slug = `${base}-${n}`
  return slug
}

export function createApplication(input: NewApplication, now = new Date().toISOString()): Application {
  const { jobMarkdown: job, ...fields } = newApplicationSchema.parse(input)
  const slug = freeSlug(applicationSlug(fields.company, fields.role, now) || `application-${now.slice(0, 10)}`)
  const application = writeApplication({ ...fields, slug, createdAt: now, updatedAt: now })
  if (job) {
    writeFileAtomic(workspacePath('applications', slug, 'job.md'), jobMarkdown(fields.source, fields.url, now, job))
  }
  return application
}

/**
 * Applies an edit. Only the keys the client actually sent are merged — a schema default (`pros: []`) must never wipe
 * what the AI wrote.
 */
export function updateApplication(slug: string, patch: ApplicationPatch, now = new Date().toISOString()): Application {
  requireSlug(slug)
  const current = readApplication(slug)
  if (!current?.application) {
    throw new HttpError(409, 'application.json has problems: fix it before editing here.', 'invalid_file')
  }
  const parsed = applicationPatchSchema.parse(patch) as Record<string, unknown>
  const sent = Object.fromEntries(Object.keys(patch).map((k) => [k, parsed[k]]))
  const merged: Record<string, unknown> = { ...current.application, ...sent, slug, updatedAt: now }
  for (const [k, v] of Object.entries(merged)) if (v === undefined || v === null) delete merged[k]
  return writeApplication(merged as Application)
}

/** Saves a recruiter message the person pasted: `messages/<date>-<n>.md`. */
export function saveMessage(slug: string, text: string, now = new Date().toISOString()): string {
  requireSlug(slug)
  const day = now.slice(0, 10)
  const existing = new Set(entries(`applications/${slug}/messages`, 'files', '.md'))
  let n = 1
  while (existing.has(`${day}-${n}.md`)) n++
  const name = `${day}-${n}.md`
  writeFileAtomic(workspacePath('applications', slug, 'messages', name), `${text.trim()}\n`)
  return name
}

/** "Delete" moves the folder to `.mzn/trash/` — a CV-era decision should be undoable from the file manager. */
export function trashApplication(slug: string, now = new Date().toISOString()): void {
  requireSlug(slug)
  const trash = workspacePath('.mzn', 'trash')
  mkdirSync(trash, { recursive: true })
  renameSync(workspacePath('applications', slug), path.join(trash, `${slug}-${now.replace(/[:.]/g, '-')}`))
}

// ── metrics ──────────────────────────────────────────────────────────────────

const ANSWERED: readonly Status[] = ['screening', 'interviewing', 'offer', 'accepted', 'rejected']

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function metrics(
  list: Application[] = readApplications().flatMap((r) => (r.application ? [r.application] : [])),
): Metrics {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>
  for (const a of list) byStatus[a.status]++
  const sent = list.filter((a) => a.status !== 'saved')
  const answered = sent.filter((a) => ANSWERED.includes(a.status) || a.stages.length > 0)
  const days = list.flatMap((a) => {
    const first = a.stages
      .map((s) => s.date)
      .filter((d): d is string => Boolean(d))
      .sort()[0]
    if (!a.appliedAt || !first) return []
    const diff = (Date.parse(first) - Date.parse(a.appliedAt)) / 86_400_000
    return diff >= 0 ? [diff] : []
  })
  return {
    total: list.length,
    active: list.filter((a) => !CLOSED_STATUSES.includes(a.status) && a.status !== 'saved').length,
    byStatus,
    responseRate: sent.length ? answered.length / sent.length : null,
    daysToFirstInterview: median(days),
  }
}

// ── materials the app edits ──────────────────────────────────────────────────

/** Saves the cover letter after the person edits it in the app, keeping (or creating) its front matter. */
export function saveLetter(slug: string, body: string, tone: string, language: string, now = new Date().toISOString()) {
  requireSlug(slug)
  const relative = `applications/${slug}/cover-letter.md`
  const content = `---\ntone: ${tone}\nlanguage: ${language}\ngeneratedAt: ${now}\n---\n\n${body.trim()}\n`
  const problems = validateFile(relative, content) ?? []
  if (problems.length) throw new HttpError(422, problems.join(' '), 'invalid')
  writeFileAtomic(workspacePath(relative), content)
}

/** Changes the template of a résumé (the only field the app writes in a file the AI owns). */
export function setResumeTemplate(relative: string, template: string) {
  const content = readText(relative)
  if (content === null) throw new HttpError(404, 'Résumé not found.', 'not_found')
  const next = `${JSON.stringify({ ...JSON.parse(content), template }, null, 2)}\n`
  const problems = validateFile(relative, next) ?? []
  if (problems.length) throw new HttpError(422, problems.join(' '), 'invalid')
  writeFileAtomic(workspacePath(relative), next)
}

// ── overview ─────────────────────────────────────────────────────────────────

/** The CV's text, for the ATS score of applications without a tailored résumé. */
function cvText(): string | null {
  return readText('profile/cv.md')
}

function jobBody(slug: string): string | null {
  const job = readText(`applications/${slug}/job.md`)
  return job === null ? null : (readFrontMatter(job)?.body ?? job)
}

export function atsFor(slug: string, resume: Resume | null, cv = cvText()): number | null {
  const job = jobBody(slug)
  if (!job) return null
  if (resume) return atsReport(job, resumeText(resume), resumeChecks(resume)).score
  return cv ? atsReport(job, cv).score : null
}

export function overview(): Overview {
  const cv = cvText()
  const apps: OverviewApplication[] = []
  const recent: Overview['recent'] = []
  for (const read of readApplications()) {
    const a = read.application
    if (!a) continue
    const d = applicationDetail(a.slug)
    apps.push({
      slug: a.slug,
      company: a.company,
      role: a.role,
      status: a.status,
      workModel: a.workModel ?? null,
      updatedAt: a.updatedAt,
      fit: d.fit?.score ?? null,
      hasJob: d.job !== null,
      hasResume: d.resume !== null,
      hasLetter: d.letter !== null,
      hasSalary: d.salary !== null,
      ats: atsFor(a.slug, d.resume, cv),
      nextSteps: a.nextSteps.map((s) => ({ what: s.what, due: s.due ?? null, done: s.done })),
      stages: a.stages.map((s) => ({ type: s.type, date: s.date ?? null, result: s.result })),
      practice: d.interviews.flatMap((i) =>
        i.session
          ? [
              {
                id: i.id,
                type: i.session.interviewType,
                date: i.id.slice(0, 10),
                score: i.feedback?.scores.length
                  ? i.feedback.scores.reduce((sum, s) => sum + s.score, 0) / i.feedback.scores.length
                  : null,
              },
            ]
          : [],
      ),
      debriefs: d.debriefs.length,
    })
    // only what already happened: a next step due next week is not "recent activity"
    const now = new Date().toISOString()
    for (const e of d.timeline.filter((e) => e.at.slice(0, 10) <= now.slice(0, 10)).slice(0, 6)) {
      recent.push({ ...e, slug: a.slug, company: a.company })
    }
  }
  recent.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
  const profile = readText('profile/profile.json')
  let profileName: string | null = null
  try {
    profileName = profile ? ((JSON.parse(profile) as { name?: string }).name ?? null) : null
  } catch {
    /* a broken profile shows its problems on the profile screen */
  }
  return {
    applications: apps.sort((x, y) => (x.updatedAt < y.updatedAt ? 1 : -1)),
    metrics: metrics(readApplications().flatMap((r) => (r.application ? [r.application] : []))),
    recent: recent.slice(0, 10),
    hasCv: Boolean(cv?.trim()),
    // any résumé in profile/ counts: an AI may have named the first one resume.<language>.json
    hasBaseResume: listResumes().some((r) => r.resume !== null),
    profileName,
  }
}

// ── résumés and discoveries (workspace-level files) ──────────────────────────

export function listResumes(): ResumeFile[] {
  return entries('profile', 'files', '.json')
    .filter((name) => /^resume(\.(en|pt-BR))?\.json$/.test(name))
    .map((name) => {
      const r = readJson<Resume>(`profile/${name}`, resumeSchema)
      return { name, resume: r.data, problems: r.problems }
    })
}

export function listDiscoveries(): DiscoveryFile[] {
  return entries('discoveries', 'files', '.json')
    .reverse()
    .map((name) => {
      const r = readJson<Discovery>(`discoveries/${name}`, discoverySchema)
      return { name, discovery: r.data, problems: r.problems }
    })
}

/** Marks one discovered job as saved or dismissed (the only field the app writes there). */
export function setDiscoveryStatus(name: string, index: number, status: 'new' | 'saved' | 'dismissed') {
  if (!/^\d{4}-\d{2}-\d{2}(-\d+)?\.json$/.test(name)) throw new HttpError(404, 'Search not found.', 'not_found')
  const relative = `discoveries/${name}`
  const r = readJson<Discovery>(relative, discoverySchema)
  if (!r.data) throw new HttpError(409, 'This search file has problems.', 'invalid_file')
  const job = r.data.jobs[index]
  if (!job) throw new HttpError(404, 'Job not found.', 'not_found')
  job.status = status
  writeFileAtomic(workspacePath(relative), `${JSON.stringify(r.data, null, 2)}\n`)
}
