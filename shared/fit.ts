/**
 * The fit analysis: `applications/<slug>/fit.json`, written by the AI (`analyze-fit`) from the profile, the CV, the job
 * post and the company research. Every claim points back to evidence, and every gap comes with how to address it —
 * a list of gaps alone only makes the person anxious.
 */

import { z } from 'zod'
import { languageSchema } from './languages.js'
import { isoDateTime, optionalText, sentences, text, webUrl } from './common.js'

export const fitSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    scoreReason: text(600),
    matches: z
      .array(z.object({ point: text(200), evidence: text(400) }).strict())
      .max(20)
      .default([]),
    gaps: z
      .array(z.object({ point: text(200), howToAddress: text(600) }).strict())
      .max(20)
      .default([]),
    redFlags: sentences(10),
    /** what to say to impress, grounded in the CV — never invented experience */
    talkingPoints: sentences(12, 600),
    questionsToAsk: sentences(10),
    /** the workspace files and public pages used */
    sources: z
      .array(
        z
          .object({ title: text(200), url: webUrl.optional(), file: optionalText(200) })
          .strict()
          .refine((s) => s.url || s.file, { message: 'A source needs a url or a file.' }),
      )
      .min(1)
      .max(20),
    language: languageSchema,
    generatedAt: isoDateTime,
  })
  .strict()
export type Fit = z.infer<typeof fitSchema>
