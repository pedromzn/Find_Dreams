/**
 * The languages the app speaks. English is the base: every text in the interface exists in English first, and each
 * other language is a dictionary with the same keys (`web/src/i18n/`), checked by the type system.
 *
 * Two different things carry a language:
 * - the **interface** (buttons, menus, messages): the person's choice, asked the first time the app opens;
 * - each **interview** (simulated or debriefed): the language the interviewer speaks. A Brazilian developer applying
 *   abroad rehearses in English with a Portuguese interface, and the other way around.
 *
 * To add a language: add it here (with its Kokoro voices and Whisper code) and write `web/src/i18n/<code>.ts`.
 */

import { z } from 'zod'

export const LANGUAGES = ['en', 'pt-BR'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'en'
export const languageSchema = z.enum(LANGUAGES)

export interface LanguageData {
  /** the name in the language itself, for the picker */
  name: string
  /** BCP 47 tag for `Intl` and `<html lang>` */
  bcp47: string
  /** the Kokoro language code (voice interviews) */
  kokoro: string
  /** the Kokoro voices for this language; the first is the default interviewer */
  voices: readonly string[]
  /** the Whisper language code (voice interviews) */
  whisper: string
}

export const LANGUAGE_DATA: Record<Language, LanguageData> = {
  en: {
    name: 'English',
    bcp47: 'en-US',
    kokoro: 'en-us',
    voices: ['af_heart', 'am_michael', 'af_bella', 'am_fenrir'],
    whisper: 'en',
  },
  'pt-BR': {
    name: 'Português (Brasil)',
    bcp47: 'pt-BR',
    kokoro: 'pt-br',
    voices: ['pf_dora', 'pm_alex', 'pm_santa'],
    whisper: 'pt',
  },
}

/** The closest supported language for a browser tag like `pt`, `pt-PT` or `en-GB`. */
export function closestLanguage(tag: string | null | undefined): Language {
  const t = (tag ?? '').toLowerCase()
  if (t.startsWith('pt')) return 'pt-BR'
  return DEFAULT_LANGUAGE
}

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
