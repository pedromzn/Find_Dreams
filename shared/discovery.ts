/**
 * A job search the person's AI ran (`find-jobs`): `discoveries/<yyyy-mm-dd>.json`. The AI looks only at public job
 * pages (company career sites, Greenhouse, Lever, Ashby, Gupy boards…) — never LinkedIn, never profiles of people — and
 * lists what fits the criteria. Nothing is applied to: the person triages here, and "save" creates an application.
 *
 * The app writes back only each job's `status` (new → saved or dismissed).
 */

import { z } from 'zod'
import { isoDate, isoDateTime, optionalText, text, webUrl, WORK_MODELS } from './common.js'
import { languageSchema } from './languages.js'

export const DISCOVERY_STATUSES = ['new', 'saved', 'dismissed'] as const

export const discoveredJobSchema = z
  .object({
    company: text(120),
    role: text(160),
    url: webUrl,
    location: optionalText(120),
    workModel: z.enum(WORK_MODELS).optional(),
    /** what the post says about pay, as written (it may be absent) */
    salary: optionalText(120),
    postedAt: isoDate.optional(),
    /** why it fits, grounded in the profile and the CV */
    why: text(500),
    /** 0–100, the AI's quick estimate (the full analysis is `analyze-fit`, after saving) */
    match: z.number().int().min(0).max(100),
    status: z.enum(DISCOVERY_STATUSES).default('new'),
  })
  .strict()
export type DiscoveredJob = z.infer<typeof discoveredJobSchema>

export const discoverySchema = z
  .object({
    /** the criteria used, in words (from the request and the profile) */
    criteria: text(1000),
    /** the public sources searched */
    sources: z.array(text(200)).min(1).max(30),
    jobs: z.array(discoveredJobSchema).max(60),
    language: languageSchema,
    generatedAt: isoDateTime,
  })
  .strict()
export type Discovery = z.infer<typeof discoverySchema>
