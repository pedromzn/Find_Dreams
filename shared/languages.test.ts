import { describe, expect, it } from 'vitest'
import { closestLanguage, isLanguage, LANGUAGE_DATA, LANGUAGES } from './languages.js'

describe('languages', () => {
  it('maps browser tags to a supported language', () => {
    expect(closestLanguage('pt')).toBe('pt-BR')
    expect(closestLanguage('pt-PT')).toBe('pt-BR')
    expect(closestLanguage('en-GB')).toBe('en')
    expect(closestLanguage('de-DE')).toBe('en')
    expect(closestLanguage(null)).toBe('en')
  })

  it('every language has at least one voice and a Whisper code', () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_DATA[language].voices.length).toBeGreaterThan(0)
      expect(LANGUAGE_DATA[language].whisper).toMatch(/^[a-z]{2}$/)
    }
  })

  it('isLanguage accepts only the known codes', () => {
    expect(isLanguage('pt-BR')).toBe(true)
    expect(isLanguage('pt')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })
})
