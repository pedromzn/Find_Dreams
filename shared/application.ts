/**
 * One application: `applications/<slug>/application.json` in the workspace. The heart of the tracker — written by the
 * app (forms) and by the AI (`track-application`), validated here either way.
 *
 * Contacts hold only what the person typed: a name and a role. No e-mail, phone or profile link — the app does not
 * build files on recruiters (LGPD; see docs/PLAN.md, section 2).
 */

import { z } from 'zod'
import {
  isoDate,
  isoDateTime,
  optionalText,
  payRangeSchema,
  sentences,
  slugify,
  slugSchema,
  text,
  webUrl,
  WORK_MODELS,
} from './common.js'
import { interviewTypeSchema } from './interviewTypes.js'

export const SOURCES = ['linkedin', 'gupy', 'greenhouse', 'lever', 'indeed', 'referral', 'other'] as const
export type Source = (typeof SOURCES)[number]

export const SENIORITIES = ['intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'lead', 'manager'] as const

export const CONTRACT_TYPES = ['clt', 'pj', 'contractor', 'permanent', 'temporary', 'internship', 'other'] as const

/**
 * The life of an application. `ghosted` is a real outcome (no answer for weeks), not a failure of the tracker; the
 * person marks it, the app may suggest it.
 */
export const STATUSES = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
] as const
export type Status = (typeof STATUSES)[number]
export const statusSchema = z.enum(STATUSES)

/** The statuses where the process is over: they leave the board's active columns. */
export const CLOSED_STATUSES: readonly Status[] = ['accepted', 'rejected', 'withdrawn', 'ghosted']

export const STAGE_RESULTS = ['scheduled', 'pending', 'passed', 'failed', 'cancelled'] as const

const stageSchema = z
  .object({
    type: interviewTypeSchema,
    date: isoDate.optional(),
    result: z.enum(STAGE_RESULTS).default('scheduled'),
    notes: optionalText(1000),
  })
  .strict()

const nextStepSchema = z
  .object({
    what: text(200),
    due: isoDate.optional(),
    done: z.boolean().default(false),
  })
  .strict()

const contactSchema = z.object({ name: text(80), role: text(80) }).strict()

/** The fields, without the cross-field rules (`.pick`/`.partial` need a plain object). */
export const applicationFields = z
  .object({
    /** the folder name: `<company>-<role>-<yyyymmdd>` (`applicationSlug`) */
    slug: slugSchema,
    company: text(120),
    role: text(160),
    seniority: z.enum(SENIORITIES).optional(),
    url: webUrl.optional(),
    source: z.enum(SOURCES),
    location: optionalText(120),
    workModel: z.enum(WORK_MODELS).optional(),
    /** what the job post announced, or what the recruiter told (`salaryKind`) */
    salary: payRangeSchema.optional(),
    salaryKind: z.enum(['announced', 'informed']).optional(),
    contract: z.enum(CONTRACT_TYPES).optional(),
    status: statusSchema,
    stages: z.array(stageSchema).max(30).default([]),
    nextSteps: z.array(nextStepSchema).max(30).default([]),
    pros: sentences(),
    cons: sentences(),
    notes: optionalText(5000),
    contacts: z.array(contactSchema).max(20).default([]),
    appliedAt: isoDate.optional(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict()

const salaryKindNeedsSalary = (a: { salaryKind?: unknown; salary?: unknown }) =>
  a.salaryKind === undefined || a.salary !== undefined

export const applicationSchema = applicationFields.refine(salaryKindNeedsSalary, {
  message: 'salaryKind needs a salary.',
  path: ['salaryKind'],
})
export type Application = z.infer<typeof applicationSchema>
export type ApplicationInput = z.input<typeof applicationSchema>

/** `Nubank`, `Senior Backend Engineer`, `2026-11-19` → `nubank-senior-backend-engineer-20261119` */
export function applicationSlug(company: string, role: string, date: string): string {
  const day = date.slice(0, 10).replaceAll('-', '')
  return [slugify(company, 30), slugify(role, 36), day].filter(Boolean).join('-')
}

/** What the app's form sends to create an application; the server adds slug, dates and `job.md`. */
export const newApplicationSchema = applicationFields
  .pick({
    company: true,
    role: true,
    seniority: true,
    url: true,
    source: true,
    location: true,
    workModel: true,
    salary: true,
    salaryKind: true,
    contract: true,
    appliedAt: true,
    notes: true,
  })
  .extend({
    status: statusSchema.default('saved'),
    /** the job post as Markdown (pasted or captured from the link) */
    jobMarkdown: z.string().trim().max(200_000).default(''),
  })
  .strict()
  .refine(salaryKindNeedsSalary, { message: 'salaryKind needs a salary.', path: ['salaryKind'] })
export type NewApplication = z.input<typeof newApplicationSchema>

/** An edit from the app: any field but the identity and the dates the server keeps. */
export const applicationPatchSchema = applicationFields
  .omit({ slug: true, createdAt: true, updatedAt: true })
  .partial()
  .strict()
export type ApplicationPatch = z.input<typeof applicationPatchSchema>
