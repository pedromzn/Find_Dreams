/**
 * The interview voice from the command line (the app does the same from Settings → Voice).
 *   npm run voice:install                              installs Kokoro + Whisper in the data folder (once, ~1 GB)
 *   npm run voice:test [-- "phrase"] [--language en|pt-BR]   speaks a phrase and transcribes it back
 */

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { isLanguage, type Language } from '../shared/languages.js'
import { config } from '../server/config.js'
import { closeVoice, installVoice, speak, transcribe, voiceStatus } from '../server/voice/voice.js'

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2)
  if (command === 'install') {
    await installVoice((step) => console.log(`… ${step}`))
    console.log(`Done: the voice is in ${path.join(config.dataFolder, 'voice')}.`)
    return 0
  }
  if (command === 'test') {
    const i = rest.indexOf('--language')
    const language: Language = i >= 0 && isLanguage(rest[i + 1]) ? (rest[i + 1] as Language) : 'pt-BR'
    const phrase =
      rest.filter((_, j) => i < 0 || (j !== i && j !== i + 1)).join(' ') ||
      (language === 'en'
        ? 'Hi! Tell me about yourself and your last project.'
        : 'Olá! Me conta um pouco sobre você e seu último projeto.')
    console.log(await voiceStatus())
    const t0 = Date.now()
    const wav = await speak(phrase, language)
    const t1 = Date.now()
    const file = path.join(config.dataFolder, 'voice-test.wav')
    writeFileSync(file, wav)
    console.log(`Spoke in ${t1 - t0} ms → ${file}`)
    const text = await transcribe(wav, language)
    console.log(`Heard in ${Date.now() - t1} ms: "${text}"`)
    closeVoice()
    return 0
  }
  console.log('Usage: npm run voice:install  |  npm run voice:test [-- "phrase"] [--language en|pt-BR]')
  return command ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().then(
    (c) => process.exit(c),
    (e) => {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`)
      process.exit(1)
    },
  )
}
