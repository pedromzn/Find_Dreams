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
  Metrics,
  PersonaSummary,
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
import { validateFile } from '../../shared/workspace.js'
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
