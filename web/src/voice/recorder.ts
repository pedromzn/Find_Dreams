/**
 * The microphone for a voice interview: records one answer as 16 kHz mono 16-bit WAV — what Whisper wants, so the
 * server needs no ffmpeg — and notices on its own when the person stopped talking (volume-based silence detection,
 * with the room's noise measured at the start). Adapted from learning-anything's Feynman microphone.
 *
 * The microphone is taken only while an answer is recorded: holding it while the interviewer speaks makes Bluetooth
 * headsets drop to the call profile and the voice sound robotic.
 */

const RATE = 16_000
const MAX_MS = 120_000
const MIN_SPEECH_MS = 400

export interface RecordOptions {
  /** silence after speech that ends the answer */
  silenceMs?: number
  onLevel?: (level: number) => void
  signal?: AbortSignal
}

/** Float samples → 16-bit PCM WAV bytes. */
export function encodeWav(samples: Float32Array, rate = RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/** Records one answer. Resolves with the WAV, or null when nobody spoke (or it was cancelled). */
export async function recordAnswer({ silenceMs = 1800, onLevel, signal }: RecordOptions = {}): Promise<Blob | null> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot record audio.')
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true },
  })
  const context = new AudioContext({ sampleRate: RATE })
  const source = context.createMediaStreamSource(stream)
  // ScriptProcessor is deprecated but universal in Chromium (and needs no worklet file, which a strict CSP may block)
  const processor = context.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  let noise = 0.01
  let calibrated = 0
  let spoke = 0
  let quiet = 0
  const started = Date.now()

  return new Promise((resolve, reject) => {
    const finish = (keep: boolean) => {
      processor.disconnect()
      source.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      void context.close()
      if (!keep || spoke < MIN_SPEECH_MS) return resolve(null)
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const all = new Float32Array(total)
      let offset = 0
      for (const c of chunks) {
        all.set(c, offset)
        offset += c.length
      }
      resolve(encodeWav(all, context.sampleRate))
    }
    signal?.addEventListener('abort', () => finish(false), { once: true })
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      chunks.push(new Float32Array(input))
      let sum = 0
      for (const v of input) sum += v * v
      const rms = Math.sqrt(sum / input.length)
      const ms = (input.length / context.sampleRate) * 1000
      onLevel?.(Math.min(1, rms * 8))
      if (calibrated < 300) {
        // the first 300 ms measure the room
        noise = Math.max(0.005, (noise + rms) / 2)
        calibrated += ms
        return
      }
      if (rms > noise * 2.5) {
        spoke += ms
        quiet = 0
      } else if (spoke >= MIN_SPEECH_MS) quiet += ms
      if ((spoke >= MIN_SPEECH_MS && quiet >= silenceMs) || Date.now() - started > MAX_MS) finish(true)
    }
    source.connect(processor)
    processor.connect(context.destination)
    context.resume().catch(reject)
  })
}
