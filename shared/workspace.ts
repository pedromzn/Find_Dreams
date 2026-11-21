/**
 * The map of the workspace folder: which file is which, and how each one is validated. Pure functions (no disk), so the
 * same code serves the server, `npm run vagas:validate` and — in the desktop app — the packaged `mzn-vagas validate`
 * the person's AI calls (there is no npm in the workspace).
 *
 *   profile/profile.json                                         profile
 *   profile/cv.md                                                Markdown, not empty
 *   profile/resume.json, profile/resume.<language>.json          structured résumé (base, translations)
 *   applications/<slug>/application.json                         application (slug = folder)
 *   applications/<slug>/job.md                                   front matter: source, capturedAt, url?
 *   applications/<slug>/company.md                               front matter: researchedAt; at least one link
 *   applications/<slug>/fit.json                                 fit
 *   applications/<slug>/interviewers/<id>.json                   persona (id = file name)
 *   applications/<slug>/interviews/<date>-<type>/transcript.json simulated session (application = folder)
 *   applications/<slug>/interviews/<date>-<type>/feedback.json   feedback of that session
 *   applications/<slug>/debriefs/<date>-<type>.json              debrief of a real interview
 *   applications/<slug>/messages/<message>.drafts.md             reply drafts: 2 or 3 `## ` options
 *   applications/<slug>/resume.json                              résumé tailored to this job
 *   applications/<slug>/cover-letter.md                          front matter: tone, language, generatedAt
 *   applications/<slug>/salary.md                                front matter: researchedAt; at least one link
 *   applications/<slug>/follow-ups/<date>.md                     follow-up drafts: 2 or 3 `## ` options
 *   discoveries/<date>.json                                      a job search the AI ran
 *   requests/<id>.json                                           a task the app handed to the AI
 *
 * Anything else (messages, the agent kit, notes) is the person's and the AI's business: not validated.
 */

import { z } from 'zod'
import { applicationSchema, SOURCES } from './application.js'
import { isoDate, isoDateTime, SLUG_PATTERN, webUrl } from './common.js'
import { fitSchema } from './fit.js'
import {
  debriefSchema,
  interviewerPersonaSchema,
  interviewFeedbackSchema,
  interviewSessionSchema,
} from './interview.js'
import { INTERVIEW_TYPES } from './interviewTypes.js'
import { profileSchema } from './profile.js'
import { requestSchema } from './request.js'
import { resumeSchema } from './resume.js'
import { discoverySchema } from './discovery.js'
import { languageSchema } from './languages.js'

export const FILE_KINDS = [
  'profile',
  'cv',
  'application',
  'job',
  'company',
  'fit',
  'persona',
  'session',
  'feedback',
  'debrief',
  'drafts',
  'request',
  'resume',
  'letter',
  'salary',
  'followup',
  'discovery',
] as const
export type FileKind = (typeof FILE_KINDS)[number]

export interface WorkspaceFile {
  kind: FileKind
  /** the application folder, for files inside `applications/<slug>/` */
  application?: string
  /** the base name without extension (`interviewers/<id>.json`, `debriefs/<date>-<type>.json`) */
  name?: string
}

const SLUG = SLUG_PATTERN.source.slice(1, -1)
/** `2026-11-12-hr_screening`, or `…-2` for a second one on the same day */
const DATED_TYPE = `\\d{4}-\\d{2}-\\d{2}-(?:${INTERVIEW_TYPES.join('|')})(?:-\\d+)?`

/** The interview type inside a dated name (`2026-11-12-technical-2` → `technical`). */
export const typeOfDated = (name: string) => name.slice(11).replace(/-\d+$/, '')

const PATTERNS: Array<[RegExp, FileKind]> = [
  [/^profile\/profile\.json$/, 'profile'],
  [/^profile\/cv\.md$/, 'cv'],
  [new RegExp(`^applications/(${SLUG})/application\\.json$`), 'application'],
  [new RegExp(`^applications/(${SLUG})/job\\.md$`), 'job'],
  [new RegExp(`^applications/(${SLUG})/company\\.md$`), 'company'],
  [new RegExp(`^applications/(${SLUG})/fit\\.json$`), 'fit'],
  [new RegExp(`^applications/(${SLUG})/interviewers/(${SLUG})\\.json$`), 'persona'],
  [new RegExp(`^applications/(${SLUG})/interviews/(${DATED_TYPE})/transcript\\.json$`), 'session'],
  [new RegExp(`^applications/(${SLUG})/interviews/(${DATED_TYPE})/feedback\\.json$`), 'feedback'],
  [new RegExp(`^applications/(${SLUG})/debriefs/(${DATED_TYPE})\\.json$`), 'debrief'],
  [new RegExp(`^applications/(${SLUG})/messages/([\\w-]+)\\.drafts\\.md$`), 'drafts'],
  [/^requests\/()(\d{8}-\d{6}-[a-z0-9-]+)\.json$/, 'request'],
  [/^profile\/resume(?:\.(?:en|pt-BR))?\.json$/, 'resume'],
  [new RegExp(`^applications/(${SLUG})/resume\\.json$`), 'resume'],
  [new RegExp(`^applications/(${SLUG})/cover-letter\\.md$`), 'letter'],
  [new RegExp(`^applications/(${SLUG})/salary\\.md$`), 'salary'],
  [new RegExp(`^applications/(${SLUG})/follow-ups/(\\d{4}-\\d{2}-\\d{2}(?:-\\d+)?)\\.md$`), 'followup'],
  [/^discoveries\/()(\d{4}-\d{2}-\d{2}(?:-\d+)?)\.json$/, 'discovery'],
]

/** Which file this is, from its path relative to the workspace (`/` or `\` separators). Null = not validated. */
export function classify(relativePath: string): WorkspaceFile | null {
  const p = relativePath.replaceAll('\\', '/').replace(/^\.\//, '')
  for (const [pattern, kind] of PATTERNS) {
    const m = pattern.exec(p)
    if (m) return { kind, ...(m[1] ? { application: m[1] } : {}), ...(m[2] ? { name: m[2] } : {}) }
  }
  return null
}

// ── Markdown front matter ────────────────────────────────────────────────────

/**
 * A minimal `---` front matter: one `key: value` per line, no nesting. Enough for a URL and a date, and simple enough
 * for any AI to write right the first time (no YAML library, no YAML surprises).
 */
export function readFrontMatter(markdown: string): { data: Record<string, string>; body: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown)
  if (!m) return null
  const data: Record<string, string> = {}
  for (const line of m[1]!.split(/\r?\n/)) {
    if (!line.trim()) continue
    const i = line.indexOf(':')
    if (i < 1) return null
    data[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { data, body: m[2]! }
}

export const jobFrontMatterSchema = z
  .object({ source: z.enum(SOURCES), url: webUrl.optional(), capturedAt: z.union([isoDateTime, isoDate]) })
  .strict()

export const companyFrontMatterSchema = z.object({ researchedAt: z.union([isoDateTime, isoDate]) }).strict()

export const LETTER_TONES = ['formal', 'direct', 'warm'] as const
export type LetterTone = (typeof LETTER_TONES)[number]

export const letterFrontMatterSchema = z
  .object({ tone: z.enum(LETTER_TONES), language: languageSchema, generatedAt: z.union([isoDateTime, isoDate]) })
  .strict()

/** The salary research: when it was done and the range it suggests asking for (as written, e.g. "R$ 18.000"). */
export const salaryFrontMatterSchema = z
  .object({
    researchedAt: z.union([isoDateTime, isoDate]),
    low: z.string().trim().max(40).optional(),
    high: z.string().trim().max(40).optional(),
  })
  .strict()

// ── validation ───────────────────────────────────────────────────────────────

const JSON_SCHEMAS: Partial<Record<FileKind, z.ZodType>> = {
  profile: profileSchema,
  application: applicationSchema,
  fit: fitSchema,
  persona: interviewerPersonaSchema,
  session: interviewSessionSchema,
  feedback: interviewFeedbackSchema,
  debrief: debriefSchema,
  request: requestSchema,
  resume: resumeSchema,
  discovery: discoverySchema,
}

const MAX_PROBLEMS = 20

function zodProblems(error: z.ZodError): string[] {
  return error.issues
    .slice(0, MAX_PROBLEMS)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
}

function markdownProblems(file: WorkspaceFile, content: string): string[] {
  if (file.kind === 'cv') return content.trim() ? [] : ['The CV is empty.']
  if (file.kind === 'drafts' || file.kind === 'followup') {
    const options = content.match(/^## /gm)?.length ?? 0
    return options >= 2 && options <= 3
      ? []
      : [`Write 2 or 3 reply options, each under a "## " heading (found ${options}).`]
  }
  const front = readFrontMatter(content)
  if (!front) return ['Missing the front matter: start the file with a `---` block of `key: value` lines.']
  const problems: string[] = []
  const schema =
    file.kind === 'job'
      ? jobFrontMatterSchema
      : file.kind === 'letter'
        ? letterFrontMatterSchema
        : file.kind === 'salary'
          ? salaryFrontMatterSchema
          : companyFrontMatterSchema
  const parsed = schema.safeParse(front.data)
  if (!parsed.success) problems.push(...zodProblems(parsed.error).map((p) => `front matter ${p}`))
  if (!front.body.trim()) problems.push('The body is empty.')
  if (file.kind === 'company' && !/https?:\/\/\S+/.test(front.body)) {
    problems.push('Company research must cite at least one public source link.')
  }
  if (file.kind === 'salary' && !/https?:\/\/\S+/.test(front.body)) {
    problems.push('Salary research must cite at least one public source link.')
  }
  return problems
}

/** Cross-checks the path makes possible: the folder and the content must agree. */
function pathProblems(file: WorkspaceFile, data: Record<string, unknown>): string[] {
  if (file.kind === 'application' && data.slug !== file.application) {
    return [`slug: must match the folder name ("${file.application}").`]
  }
  if (file.kind === 'request' && data.id !== file.name) return [`id: must match the file name ("${file.name}").`]
  if (file.kind === 'persona' && data.id !== file.name) return [`id: must match the file name ("${file.name}").`]
  if (file.kind === 'resume' && file.application) {
    const tailoring = data.tailoring as { application?: string } | undefined
    if (tailoring?.application !== file.application) {
      return [`tailoring.application: a tailored résumé must name its application ("${file.application}").`]
    }
  }
  if (file.kind === 'session' && data.application !== file.application) {
    return [`application: must match the folder name ("${file.application}").`]
  }
  if ((file.kind === 'session' || file.kind === 'debrief') && file.name) {
    const type = typeOfDated(file.name)
    if (data.interviewType !== type) return [`interviewType: must match the folder or file name ("${type}").`]
  }
  if (file.kind === 'debrief' && file.name && data.date !== file.name.slice(0, 10)) {
    return [`date: must match the file name ("${file.name.slice(0, 10)}").`]
  }
  return []
}

/**
 * The problems of one workspace file, as sentences for the AI to fix (empty = valid). `null` = this path is not a
 * file the app validates.
 */
export function validateFile(relativePath: string, content: string): string[] | null {
  const file = classify(relativePath)
  if (!file) return null
  const schema = JSON_SCHEMAS[file.kind]
  if (!schema) return markdownProblems(file, content)
  let data: unknown
  try {
    data = JSON.parse(content)
  } catch (e) {
    return [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`]
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) return zodProblems(parsed.error)
  return pathProblems(file, parsed.data as Record<string, unknown>)
}

/** Every JSON schema, for `vagas:schemas` (docs/schemas/<name>.schema.json). */
export const SCHEMAS: Record<string, z.ZodType> = {
  profile: profileSchema,
  application: applicationSchema,
  fit: fitSchema,
  'interviewer-persona': interviewerPersonaSchema,
  'interview-session': interviewSessionSchema,
  'interview-feedback': interviewFeedbackSchema,
  debrief: debriefSchema,
  'job-front-matter': jobFrontMatterSchema,
  'company-front-matter': companyFrontMatterSchema,
  request: requestSchema,
  resume: resumeSchema,
  discovery: discoverySchema,
  'letter-front-matter': letterFrontMatterSchema,
  'salary-front-matter': salaryFrontMatterSchema,
}
