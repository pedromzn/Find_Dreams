/**
 * The structured résumé: `profile/resume.json` (the base, built from `profile/cv.md`), `profile/resume.<language>.json`
 * (a translation of the base) and `applications/<slug>/resume.json` (a version tailored to one job). Written by the AI
 * (`tailor-resume`) and rendered by the app in one of its templates; the app only changes `template`.
 *
 * Every line comes from the CV or the profile: tailoring reorders, rewrites and selects, it never invents experience.
 * This is the person's own résumé, so their own contact details belong here (unlike recruiters', which the app never
 * stores — see `application.ts`).
 */

import { z } from 'zod'
import { isoDateTime, optionalText, sentences, slugSchema, text, webUrl } from './common.js'
import { languageSchema } from './languages.js'

export const RESUME_TEMPLATES = ['modern', 'harvard', 'classic'] as const
export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number]

/** `2021-03`, `2021` or a word the person used ("present" is expressed with `current`) */
const period = z
  .string()
  .trim()
  .regex(/^\d{4}(-\d{2})?$/, 'Use YYYY or YYYY-MM.')

const experienceSchema = z
  .object({
    company: text(120),
    role: text(160),
    location: optionalText(120),
    start: period.optional(),
    end: period.optional(),
    current: z.boolean().default(false),
    /** what was done and achieved, one line each; numbers when the CV has them */
    bullets: sentences(10, 400),
  })
  .strict()

export const resumeSchema = z
  .object({
    template: z.enum(RESUME_TEMPLATES).default('modern'),
    language: languageSchema,
    basics: z
      .object({
        name: text(120),
        headline: optionalText(200),
        location: optionalText(120),
        email: z.email().max(200).optional(),
        phone: optionalText(40),
        links: z
          .array(z.object({ label: text(40), url: webUrl }).strict())
          .max(8)
          .default([]),
      })
      .strict(),
    summary: optionalText(1200),
    experience: z.array(experienceSchema).max(20).default([]),
    education: z
      .array(
        z
          .object({
            institution: text(160),
            degree: text(160),
            start: period.optional(),
            end: period.optional(),
            notes: optionalText(300),
          })
          .strict(),
      )
      .max(10)
      .default([]),
    skills: z
      .array(z.object({ group: text(60), items: z.array(text(60)).min(1).max(30) }).strict())
      .max(12)
      .default([]),
    languages: z
      .array(z.object({ language: text(40), level: text(40) }).strict())
      .max(12)
      .default([]),
    certifications: z
      .array(z.object({ name: text(160), issuer: optionalText(120), year: optionalText(10) }).strict())
      .max(20)
      .default([]),
    projects: z
      .array(z.object({ name: text(120), description: text(400), url: webUrl.optional() }).strict())
      .max(10)
      .default([]),
    /** only in a tailored version: which job it targets and what was changed for it */
    tailoring: z
      .object({
        application: slugSchema,
        changes: sentences(12, 300),
        keywordsCovered: z.array(text(60)).max(40).default([]),
      })
      .strict()
      .optional(),
    generatedAt: isoDateTime,
  })
  .strict()
export type Resume = z.infer<typeof resumeSchema>

/** The résumé as plain text, in reading order: what the ATS check reads and what "copy as text" gives. */
export function resumeText(r: Resume): string {
  const lines: string[] = [r.basics.name, r.basics.headline, r.basics.location, r.basics.email ?? '', r.summary]
  for (const e of r.experience) lines.push(`${e.role} — ${e.company}`, ...e.bullets)
  for (const e of r.education) lines.push(`${e.degree} — ${e.institution}`, e.notes)
  for (const s of r.skills) lines.push(`${s.group}: ${s.items.join(', ')}`)
  for (const l of r.languages) lines.push(`${l.language}: ${l.level}`)
  for (const c of r.certifications) lines.push(c.name)
  for (const p of r.projects) lines.push(`${p.name}: ${p.description}`)
  return lines.filter((l) => l && l.trim()).join('\n')
}

/** What a structured résumé says for sure about the ATS structure checks (the text alone cannot tell). */
export function resumeChecks(r: Resume) {
  return {
    summary: r.summary.trim().length > 0,
    contact: Boolean(r.basics.email || r.basics.phone),
    skills: r.skills.length > 0,
  }
}
