/**
 * The interview voice, 100% local: Whisper (faster-whisper) turns the candidate's answer into text, Kokoro speaks the
 * interviewer's turn. Both are Python workers kept warm by `PythonProcess` (copied from learning-anything) and
 * installed on demand into the app's data folder — not shipped in the installer (~1 GB).
 *
 * Unlike the sibling, no ffmpeg: the page records 16 kHz mono WAV itself (`web/src/voice/recorder.ts`), which is what
 * Whisper wants, so the desktop app has one dependency less. Nothing is kept: audio goes through a temp folder and is
 * deleted; only the text of the turn reaches the transcript.
 */

import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, readdirSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { LANGUAGE_DATA, type Language } from '../../shared/languages.js'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { childEnv, which } from '../agent/shellPath.js'
import { PythonProcess } from './pythonProcess.js'

const execFileAsync = promisify(execFile)

export const voiceFolder = () => path.join(config.dataFolder, 'voice')
const envFolder = () => path.join(voiceFolder(), '.venv')
const whisperFolder = () => path.join(voiceFolder(), 'whisper')

export const enginePython = (platform: NodeJS.Platform = process.platform): string =>
  platform === 'win32' ? path.join(envFolder(), 'Scripts', 'python.exe') : path.join(envFolder(), 'bin', 'python')

/** The Kokoro v1.0 model files, with the sha256 checked on download (same pins as learning-anything). */
export const MODEL_FILES = [
  {
    name: 'kokoro-v1.0.onnx',
    url: 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx',
    sha256: '7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5',
  },
  {
    name: 'voices-v1.0.bin',
    url: 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin',
    sha256: 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d',
  },
] as const

/** `small`: gets technical terms right that `base` gets wrong, still fast on CPU. `MZN_WHISPER` overrides it. */
export const whisperSize = () =>
  ['base', 'small', 'medium'].includes(process.env.MZN_WHISPER ?? '') ? process.env.MZN_WHISPER! : 'small'
const whisperModelFolder = () => path.join(whisperFolder(), `models--Systran--faster-whisper-${whisperSize()}`)

function sitePackages(): string[] {
  if (process.platform === 'win32') return [path.join(envFolder(), 'Lib', 'site-packages')]
  try {
    return readdirSync(path.join(envFolder(), 'lib')).map((d) => path.join(envFolder(), 'lib', d, 'site-packages'))
  } catch {
    return []
  }
}

const hasPackage = (name: string) => sitePackages().some((folder) => existsSync(path.join(folder, name)))

export interface VoiceStatus {
  speak: boolean
  listen: boolean
  installing: boolean
  progress: string | null
  error: string | null
  /** how it would install: uv (downloads Python on its own), a system Python, or not possible */
  installer: 'uv' | 'python' | null
}

export const kokoroInstalled = () =>
  existsSync(enginePython()) &&
  hasPackage('kokoro_onnx') &&
  MODEL_FILES.every((f) => existsSync(path.join(voiceFolder(), f.name)))
export const whisperInstalled = () =>
  existsSync(enginePython()) && hasPackage('faster_whisper') && existsSync(whisperModelFolder())

// ── install ──────────────────────────────────────────────────────────────────

const job: { installing: boolean; progress: string | null; error: string | null } = {
  installing: false,
  progress: null,
  error: null,
}

async function systemPython(): Promise<string | null> {
  for (const command of process.platform === 'win32' ? ['py', 'python'] : ['python3', 'python']) {
    const found = await which(command)
    if (!found) continue
    try {
      const { stdout } = await execFileAsync(found, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], {
        timeout: 10_000,
      })
      const [major, minor] = stdout.trim().split('.').map(Number)
      if (major === 3 && minor! >= 10 && minor! <= 13) return found
    } catch {
      /* next */
    }
  }
  return null
}

async function installer(): Promise<{ kind: 'uv' | 'python'; path: string } | null> {
  const uv = await which('uv')
  if (uv) return { kind: 'uv', path: uv }
  const python = await systemPython()
  return python ? { kind: 'python', path: python } : null
}

export async function voiceStatus(): Promise<VoiceStatus> {
  return { speak: kokoroInstalled(), listen: whisperInstalled(), ...job, installer: (await installer())?.kind ?? null }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], env, windowsHide: true })
    let err = ''
    child.stderr.on('data', (d: Buffer) => (err = (err + d.toString()).slice(-2000)))
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${path.basename(command)} failed: ${err.trim().split('\n').pop() ?? code}`)),
    )
  })
}

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

/**
 * Installs both engines (idempotent): a Python environment (uv, or a system Python 3.10–3.13), the pinned packages,
 * the Kokoro model files (sha256-checked) and the Whisper model. Runs in the background; `onProgress` reports steps.
 * Downloads only what the person asked for, from the URLs above, the Python package index and Hugging Face.
 */
export async function installVoice(onProgress: (step: string) => void = () => undefined): Promise<void> {
  if (job.installing) throw new HttpError(409, 'The voice is already being installed.', 'busy')
  const tool = await installer()
  if (!tool) {
    throw new HttpError(
      409,
      'Installing the voice needs uv (https://docs.astral.sh/uv/) or Python 3.10–3.13.',
      'voice_needs_python',
    )
  }
  job.installing = true
  job.error = null
  const step = (s: string) => {
    job.progress = s
    onProgress(s)
  }
  try {
    const env = await childEnv()
    await mkdir(voiceFolder(), { recursive: true })
    if (!existsSync(enginePython())) {
      step('python')
      if (tool.kind === 'uv') await run(tool.path, ['venv', '--quiet', '--python', '3.12', envFolder()], env)
      else await run(tool.path, ['-m', 'venv', envFolder()], env)
    }
    step('packages')
    const requirements = path.join(config.voiceScripts, 'requirements.txt')
    if (tool.kind === 'uv')
      await run(tool.path, ['pip', 'install', '--quiet', '--python', enginePython(), '-r', requirements], env)
    else
      await run(
        enginePython(),
        ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '-r', requirements],
        env,
      )
    for (const file of MODEL_FILES) {
      const destination = path.join(voiceFolder(), file.name)
      if (existsSync(destination)) continue
      step(`download:${file.name}`)
      const answer = await fetch(file.url, { redirect: 'follow' })
      if (!answer.ok || !answer.body) throw new Error(`The download of ${file.name} failed (HTTP ${answer.status}).`)
      const partial = `${destination}.partial`
      await pipeline(Readable.fromWeb(answer.body as never), createWriteStream(partial))
      if ((await sha256(partial)) !== file.sha256) {
        await rm(partial, { force: true })
        throw new Error(`${file.name} arrived different from expected (sha256). Try again.`)
      }
      await rename(partial, destination)
    }
    if (!existsSync(whisperModelFolder())) {
      step('download:whisper')
      await run(
        enginePython(),
        [
          '-c',
          'import sys; from faster_whisper import download_model; download_model(sys.argv[1], cache_dir=sys.argv[2])',
          whisperSize(),
          whisperFolder(),
        ],
        env,
      )
    }
    step('done')
  } catch (e) {
    job.error = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    job.installing = false
  }
}

// ── speaking and listening ───────────────────────────────────────────────────

const kokoro = new PythonProcess(
  'voice (Kokoro)',
  () => ({
    python: enginePython(),
    args: [
      '-I',
      path.join(config.voiceScripts, 'kokoro_worker.py'),
      path.join(voiceFolder(), MODEL_FILES[0].name),
      path.join(voiceFolder(), MODEL_FILES[1].name),
    ],
  }),
  10 * 60_000,
)

const whisper = new PythonProcess(
  'listener (Whisper)',
  () => ({
    python: enginePython(),
    args: ['-I', path.join(config.voiceScripts, 'whisper_worker.py'), whisperSize(), whisperFolder()],
  }),
  10 * 60_000,
)

/** Strips what the voice would read badly (markdown, emojis). */
export function toSpeech(text: string): string {
  return text
    .replace(/[*_#`>]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The interviewer's turn as WAV bytes. */
export async function speak(text: string, language: Language): Promise<Buffer> {
  if (!kokoroInstalled()) throw new HttpError(409, 'The voice is not installed.', 'voice_missing')
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mzn-voice-'))
  try {
    const output = path.join(folder, 'turn.wav')
    const data = LANGUAGE_DATA[language]
    await kokoro.send({ text: toSpeech(text), voice: data.voices[0], lang: data.kokoro, speed: 1.0, output })
    return await readFile(output)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

/** A 16-bit PCM WAV, as the page records it: checked before it reaches Python. */
export function isWav(bytes: Buffer): boolean {
  return bytes.length > 44 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE'
}

/** The candidate's answer as text ('' when there was no speech). The audio is deleted right after. */
export async function transcribe(wav: Buffer, language: Language, hint = ''): Promise<string> {
  if (!whisperInstalled()) throw new HttpError(409, 'The listener is not installed.', 'voice_missing')
  if (!isWav(wav)) throw new HttpError(415, 'Expected a WAV recording.', 'invalid')
  const folder = await mkdtemp(path.join(os.tmpdir(), 'mzn-listen-'))
  try {
    const file = path.join(folder, 'answer.wav')
    await writeFile(file, wav)
    const r = await whisper.send({ wav: file, hint: hint.slice(0, 400), language: LANGUAGE_DATA[language].whisper })
    return typeof r.text === 'string' ? r.text.trim() : ''
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

export function closeVoice() {
  kokoro.close()
  whisper.close()
}

/** Words Whisper should expect in a Brazilian tech job search (it hears "CLT" as "celiter" without help). */
const COMMON_TERMS = 'CLT, PJ, backend, frontend, full stack, deploy, API, React, Node.js, TypeScript, Kubernetes, SQL'

/**
 * The vocabulary hint for one application: the company, the role and the person's stack, plus common terms. Whisper
 * takes about 200 tokens as `initial_prompt`; it makes the difference on names and technical words.
 */
export function vocabularyHint(parts: { company?: string; role?: string; stack?: string[] }): string {
  const words = [parts.company, parts.role, ...(parts.stack ?? [])].filter(Boolean).join(', ')
  return `${words ? `${words}. ` : ''}${COMMON_TERMS}.`.slice(0, 400)
}
