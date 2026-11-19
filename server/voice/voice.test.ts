import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { encodeWav } from '../../web/src/voice/recorder.js'
import { config } from '../config.js'
import {
  closeVoice,
  isWav,
  kokoroInstalled,
  speak,
  toSpeech,
  transcribe,
  voiceStatus,
  whisperInstalled,
} from './voice.js'

const original = config.dataFolder

describe('the voice without the engines installed', () => {
  beforeAll(() => {
    config.dataFolder = mkdtempSync(path.join(tmpdir(), 'mzn-data-'))
  })
  afterAll(() => {
    config.dataFolder = original
  })

  it('reports nothing installed and refuses to speak or listen', async () => {
    const status = await voiceStatus()
    expect(status).toMatchObject({ speak: false, listen: false, installing: false })
    await expect(speak('Olá', 'pt-BR')).rejects.toMatchObject({ code: 'voice_missing' })
    await expect(transcribe(Buffer.from('x'), 'pt-BR')).rejects.toMatchObject({ code: 'voice_missing' })
  })
})

describe('the audio format', () => {
  it('the page records a valid 16 kHz mono 16-bit WAV', async () => {
    const samples = new Float32Array(16000).map((_, i) => Math.sin(i / 10) * 0.5)
    const wav = Buffer.from(await encodeWav(samples).arrayBuffer())
    expect(isWav(wav)).toBe(true)
    expect(wav.readUInt32LE(24)).toBe(16000)
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt16LE(34)).toBe(16)
    expect(wav.length).toBe(44 + 16000 * 2)
  })

  it('refuses anything that is not a WAV', () => {
    expect(isWav(Buffer.from('OggS....'))).toBe(false)
    expect(isWav(Buffer.alloc(10))).toBe(false)
  })

  it('cleans what the voice would read badly', () => {
    expect(toSpeech('**Olá**, tudo bem? 😊  `ok`')).toBe('Olá, tudo bem? ok')
  })
})

/**
 * A real round trip, only where the engines exist (MZN_VOICE_DATA=<a data folder with voice/ installed>): Kokoro
 * speaks a sentence and Whisper must hear it back. Never in CI (the engines are ~1 GB).
 */
describe.runIf(Boolean(process.env.MZN_VOICE_DATA))('the real voice', () => {
  beforeAll(() => {
    config.dataFolder = process.env.MZN_VOICE_DATA!
  })
  afterAll(() => {
    closeVoice()
    config.dataFolder = original
  })

  it('speaks and hears back, in both languages', async () => {
    expect(kokoroInstalled() && whisperInstalled()).toBe(true)
    for (const [language, phrase] of [
      ['pt-BR', 'Qual é a sua pretensão salarial?'],
      ['en', 'Tell me about a production incident you handled.'],
    ] as const) {
      const wav = await speak(phrase, language)
      expect(isWav(wav)).toBe(true)
      const heard = (await transcribe(wav, language)).toLowerCase()
      expect(heard).toContain(language === 'en' ? 'production incident' : 'pretensão salarial')
    }
  }, 120_000)
})

describe('helping Whisper', () => {
  it('the hint carries the company, the role, the stack and common Brazilian job terms', async () => {
    const { vocabularyHint } = await import('./voice.js')
    const hint = vocabularyHint({ company: 'Acme Pagamentos', role: 'Backend Engineer', stack: ['Node.js', 'Go'] })
    expect(hint).toMatch(/^Acme Pagamentos, Backend Engineer, Node\.js, Go\. CLT, PJ/)
    expect(vocabularyHint({}).length).toBeLessThanOrEqual(400)
  })

  it('a turn is spoken sentence by sentence', async () => {
    const { sentences } = await import('../../web/src/voice/sentences.js')
    expect(sentences('Olá, Ana! Tudo bem? Vamos começar… Me conta sobre você')).toEqual([
      'Olá, Ana!',
      'Tudo bem?',
      'Vamos começar…',
      'Me conta sobre você',
    ])
  })
})
