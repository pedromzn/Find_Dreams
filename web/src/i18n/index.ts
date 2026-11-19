/**
 * The interface language. The choice lives in this browser (`localStorage`) and is asked the first time the app opens
 * (`LanguagePicker`). Components read texts with `useT()`; code outside React uses `t()`.
 *
 * Interview content is NOT translated here: each interview runs in its own language (`shared/languages.ts`).
 *
 * Note for the desktop phase: Electron serves the app on a random port, and `localStorage` is per origin, so the
 * choice must move to the server-side settings there (see docs/ARCHITECTURE.md).
 */

import { useEffect } from 'react'
import { create } from 'zustand'
import { z } from 'zod'
import { LANGUAGE_DATA, isLanguage, closestLanguage, type Language } from '@shared/languages'
import { portugueseErrorMap } from '@shared/zodPortuguese'
import { en, type Dictionary } from './en'
import { ptBR } from './pt-BR'

export const DICTIONARIES: Record<Language, Dictionary> = { en, 'pt-BR': ptBR }

const KEY = 'mzn-vagas:language'

function storedLanguage(): Language | null {
  try {
    const v = localStorage.getItem(KEY)
    return isLanguage(v) ? v : null
  } catch {
    return null
  }
}

function apply(language: Language) {
  document.documentElement.lang = LANGUAGE_DATA[language].bcp47
  // the zod messages the app shows (form validation) follow the interface
  if (language === 'pt-BR') z.config({ ...z.locales.pt(), customError: portugueseErrorMap })
  else z.config({ ...z.locales.en(), customError: undefined })
}

interface LanguageState {
  language: Language
  /** false until the person picks a language (the first time the app opens) */
  picked: boolean
  choose: (language: Language) => void
}

const stored = storedLanguage()

export const useLanguage = create<LanguageState>((set) => ({
  language: stored ?? closestLanguage(typeof navigator === 'undefined' ? null : navigator.language),
  picked: stored !== null,
  choose: (language) => {
    try {
      localStorage.setItem(KEY, language)
    } catch {
      /* private window: the choice lasts for this visit */
    }
    apply(language)
    set({ language, picked: true })
  },
}))

apply(useLanguage.getState().language)

/** The texts in the person's language. */
export const useT = (): Dictionary => DICTIONARIES[useLanguage((s) => s.language)]

/** The texts outside React (they follow the current choice). */
export const t = (): Dictionary => DICTIONARIES[useLanguage.getState().language]

const bcp47 = () => LANGUAGE_DATA[useLanguage.getState().language].bcp47

/** Numbers and dates in the interface language. */
/** A bare `2026-11-21` is UTC midnight for `Date`: in Brazil that is the 20th. Read it as local noon instead. */
const toDate = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)

export const format = {
  number: (n: number) => n.toLocaleString(bcp47()),
  date: (iso: string) => toDate(iso).toLocaleDateString(bcp47(), { day: 'numeric', month: 'long', year: 'numeric' }),
  shortDate: (iso: string) => toDate(iso).toLocaleDateString(bcp47()),
}

/** Re-renders when the language changes (for screens that format outside `useT`). */
export function useCurrentLanguage(): Language {
  const language = useLanguage((s) => s.language)
  useEffect(() => apply(language), [language])
  return language
}
