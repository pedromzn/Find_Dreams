/**
 * Building blocks shared by every contract: bounded text, dates, links, slugs and money. The limits are not cosmetic —
 * a field the AI fills in a loop is cut here, and a screen never receives a 50 KB "company name".
 */

import { z } from 'zod'

/** Required text, trimmed, with a ceiling. */
export const text = (max: number) => z.string().trim().min(1).max(max)

/** Optional text that defaults to empty (the AI may leave it out). */
export const optionalText = (max: number) => z.string().trim().max(max).default('')

/** A list of short sentences (pros, talking points, questions…). */
export const sentences = (maxItems = 20, maxLength = 400) => z.array(text(maxLength)).max(maxItems).default([])

/** `2026-11-19` */
export const isoDate = z.iso.date()

/** `2026-11-19T14:30:00Z` or with an offset (`-03:00`) */
export const isoDateTime = z.iso.datetime({ offset: true })

/** Only http(s): a `file:` or `javascript:` link has no business in a job post or a source. */
export const webUrl = z.url({ protocol: /^https?$/, hostname: z.regexes.domain }).max(2000)

/** Lowercase letters, numbers and single hyphens: safe as a folder name on every system. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const slugSchema = z.string().regex(SLUG_PATTERN, 'Use lowercase letters, numbers and hyphens.').max(80)

/** `Nubank`, `São Paulo` → `nubank`, `sao-paulo`: accents dropped, everything else becomes a hyphen. */
export function slugify(value: string, max = 40): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

/** ISO 4217 code: BRL, USD, EUR… */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'Use the 3-letter currency code (BRL, USD, EUR).')

export const PAY_PERIODS = ['hour', 'month', 'year'] as const

/** A pay range. Either end may be missing ("up to 12k", "from 8k"), but not both. */
export const payRangeSchema = z
  .object({
    min: z.number().nonnegative().max(100_000_000).optional(),
    max: z.number().nonnegative().max(100_000_000).optional(),
    currency: currencySchema,
    period: z.enum(PAY_PERIODS).default('month'),
  })
  .strict()
  .refine((r) => r.min !== undefined || r.max !== undefined, { message: 'Give at least min or max.' })
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, {
    message: 'min must not be greater than max.',
    path: ['max'],
  })
export type PayRange = z.infer<typeof payRangeSchema>

export const WORK_MODELS = ['remote', 'hybrid', 'onsite'] as const
export type WorkModel = (typeof WORK_MODELS)[number]
