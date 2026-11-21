/**
 * The HTTP contract between the web app and the local server. Every success response is `{ data: T }`; every error is
 * `{ error, code? }` (`server/errors.ts`). Grows phase by phase, one type per route.
 */

import type { Application, Source, Status } from './application.js'
import type { WorkModel } from './common.js'
import type { Fit } from './fit.js'
import type { Debrief, InterviewerPersona, InterviewFeedback, InterviewSession } from './interview.js'
import type { Language } from './languages.js'
import type { Profile } from './profile.js'
import type { Resume } from './resume.js'
import type { Discovery } from './discovery.js'
import type { InterviewType } from './interviewTypes.js'

export interface ApiResponse<T> {
  data: T
}

export interface ApiErrorBody {
  error: string
  code?: string
}

/** `GET /api/health` */
export interface Health {
  ok: true
}

/** One row of the application index (SQLite): only what the board lists and filters by. */
export interface IndexedApplication {
  slug: string
  company: string
  role: string
  status: Status
  source: Source
  workModel: WorkModel | null
  appliedAt: string | null
  updatedAt: string
}

/**
 * `GET /api/applications`: the indexed applications with the problems of their file (an invalid file keeps its last
 * good row), plus folders whose `application.json` was never valid (company and role unknown).
 */
export type ApplicationSummary =
  | (IndexedApplication & { problems: string[] })
  | { slug: string; company: null; role: null; problems: string[] }

/** A Markdown file of the application (`job.md`, `company.md`, a message), with its validation problems. */
export interface MarkdownFile {
  name: string
  content: string
  problems: string[]
  /** for a recruiter message: the AI's reply drafts (`<name>.drafts.md`), if any */
  drafts?: MarkdownFile | null
}

export interface InterviewSummary {
  /** the folder: `2026-11-12-hr_screening` */
  id: string
  session: InterviewSession | null
  feedback: InterviewFeedback | null
  problems: string[]
}

export interface DebriefSummary {
  id: string
  debrief: Debrief | null
  problems: string[]
}

export interface PersonaSummary {
  id: string
  persona: InterviewerPersona | null
  problems: string[]
}

export type TimelineKind = 'status' | 'stage' | 'next_step' | 'message' | 'simulation' | 'debrief' | 'created'

export interface TimelineEvent {
  /** ISO date or date-time; sorts as text */
  at: string
  kind: TimelineKind
  /** a status, an interview type, a step description or a file name, depending on the kind */
  label: string
  detail?: string
}

/** `GET /api/applications/:slug`: everything the application screen shows. */
export interface ApplicationDetail {
  slug: string
  application: Application | null
  problems: string[]
  job: MarkdownFile | null
  company: MarkdownFile | null
  fit: Fit | null
  fitProblems: string[]
  personas: PersonaSummary[]
  interviews: InterviewSummary[]
  debriefs: DebriefSummary[]
  messages: MarkdownFile[]
  /** the résumé tailored to this job (`resume.json`) */
  resume: Resume | null
  resumeProblems: string[]
  letter: MarkdownFile | null
  salary: MarkdownFile | null
  followUps: MarkdownFile[]
  timeline: TimelineEvent[]
}

/** `GET /api/metrics`: the board's numbers. Null when there is not enough data yet. */
export interface Metrics {
  total: number
  active: number
  byStatus: Record<Status, number>
  /** of the applications sent, the share that got any answer (screening onwards, or a rejection) */
  responseRate: number | null
  /** median days from `appliedAt` to the first interview stage */
  daysToFirstInterview: number | null
}

/** `GET /api/profile` */
export interface ProfileData {
  profile: Profile | null
  problems: string[]
  cv: string | null
}

/** `GET /api/resumes`: the base résumé and its translations (`profile/resume*.json`). */
export interface ResumeFile {
  /** `resume.json`, `resume.en.json`… */
  name: string
  resume: Resume | null
  problems: string[]
}

/** One application as the overview screens see it (home, résumés, letters, interviews, tools). */
export interface OverviewApplication {
  slug: string
  company: string
  role: string
  status: Status
  workModel: WorkModel | null
  updatedAt: string
  fit: number | null
  hasJob: boolean
  hasResume: boolean
  hasLetter: boolean
  hasSalary: boolean
  /** the ATS score of the tailored résumé (or of the CV, when there is none) against the job post */
  ats: number | null
  nextSteps: Array<{ what: string; due: string | null; done: boolean }>
  stages: Array<{ type: InterviewType; date: string | null; result: string }>
  practice: Array<{ id: string; type: InterviewType; date: string; score: number | null }>
  debriefs: number
}

/** `GET /api/overview` */
export interface Overview {
  applications: OverviewApplication[]
  metrics: Metrics
  recent: Array<TimelineEvent & { slug: string; company: string }>
  hasCv: boolean
  hasBaseResume: boolean
  profileName: string | null
}

/** `GET /api/discoveries` */
export interface DiscoveryFile {
  name: string
  discovery: Discovery | null
  problems: string[]
}

/** `POST /api/jobs/capture`: what the link gave, for the person to review before creating the application. */
export interface CapturedJob {
  source: Source
  url: string
  title: string
  company: string
  location: string
  workModel: WorkModel | null
  markdown: string
  capturedAt: string
}

/** `GET/PUT /api/settings`: preferences kept in SQLite (survive the desktop app's random port). */
export const THEME_MODES = ['system', 'dark', 'light'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export interface Settings {
  language: Language | null
  theme: ThemeMode
  workspaceFolder: string
}

/** `GET /api/agent-kit` */
export interface KitStatus {
  version: string
  installed: string | null
  conflicts: string[]
}

/** `POST /api/requests`: the request, the prompt to paste and the folder to open the AI in. */
export interface CreatedRequest {
  request: import('./request.js').AgentRequest
  prompt: string
  folder: string
}

export interface FileReport {
  file: string
  problems: string[]
}
