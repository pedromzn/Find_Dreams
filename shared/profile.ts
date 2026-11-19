/**
 * The candidate: `profile/profile.json` in the workspace. Written by the app (first run, settings) and read by the AI
 * for every fit analysis and interview. The AI never changes it without the person asking (`agent-kit/AGENTS.md`).
 *
 * This is the most sensitive file in the workspace (salary expectation, location): it is never logged, never sent
 * anywhere by the app, and only handed to the agent when a task needs it.
 */

import { z } from 'zod'
import { optionalText, payRangeSchema, text, webUrl, WORK_MODELS } from './common.js'

export const SKILL_LEVELS = ['basic', 'intermediate', 'advanced', 'expert'] as const
export const LANGUAGE_LEVELS = ['basic', 'intermediate', 'advanced', 'fluent', 'native'] as const

export const profileSchema = z
  .object({
    name: text(120),
    /** one line: "Backend developer, 6 years, Go and Node" */
    headline: optionalText(200),
    location: optionalText(120),
    stack: z
      .array(
        z
          .object({
            name: text(60),
            level: z.enum(SKILL_LEVELS),
            years: z.number().min(0).max(50),
          })
          .strict(),
      )
      .max(60)
      .default([]),
    /** spoken languages (not programming ones), e.g. `{ "language": "English", "level": "advanced" }` */
    languages: z
      .array(z.object({ language: text(40), level: z.enum(LANGUAGE_LEVELS) }).strict())
      .max(12)
      .default([]),
    /** the work models the person accepts */
    workModels: z
      .array(z.enum(WORK_MODELS))
      .max(3)
      .default([...WORK_MODELS]),
    relocation: z.boolean().default(false),
    /** optional: many people prefer not to write it down */
    salaryExpectation: payRangeSchema.optional(),
    /** public links only (GitHub, portfolio, LinkedIn): what the person already publishes */
    links: z
      .array(z.object({ label: text(40), url: webUrl }).strict())
      .max(10)
      .default([]),
    /** the CV in Markdown, relative to the workspace (imported from PDF/DOCX by the app) */
    cvPath: z.literal('profile/cv.md').default('profile/cv.md'),
  })
  .strict()
export type Profile = z.infer<typeof profileSchema>
