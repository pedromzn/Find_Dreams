/**
 * Voice mode for the practice interview: the interviewer's turn is spoken by the local Kokoro, the answer is recorded
 * here (WAV) and transcribed by the local Whisper. Without the voice installed, the interview stays text-only and the
 * controls offer the one-time install (degrade, never break).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { DownloadSimple, Keyboard, Microphone } from '@phosphor-icons/react'
import type { Language } from '@shared/languages'
import { Button, ErrorLine, join } from '@/components/ui'
import { useT } from '@/i18n'
import { api, sessionToken, useData } from '@/lib/api'
import { useServerEvents } from '@/lib/events'
import { recordAnswer } from './recorder'
import { sentences } from './sentences'

export interface Voice {
  available: boolean
  state: 'idle' | 'listening' | 'transcribing' | 'speaking'
  label: string
  error: string | null
  listen: () => Promise<string | null>
  speak: (text: string) => Promise<void>
  stop: () => void
}

type Status = {
  speak: boolean
  listen: boolean
  installing: boolean
  progress: string | null
  error: string | null
  installer: 'uv' | 'python' | null
}

export function useVoiceStatus() {
  const status = useData<Status>('/api/voice')
  useServerEvents((e) => {
    if (e.type === 'agent' && (e.payload as { kind?: string }).kind === 'voice_install') void status.reload()
  })
  return status
}

export function useVoice(language: Language, application?: string): Voice {
  const t = useT()
  const status = useVoiceStatus()
  const [state, setState] = useState<Voice['state']>('idle')
  const [error, setError] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const abort = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abort.current?.abort()
    audio.current?.pause()
    setState('idle')
  }, [])
  useEffect(() => stop, [stop])

  const synthesize = useCallback(
    async (text: string): Promise<string> => {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-MZN-Token': sessionToken() },
        body: JSON.stringify({ text, language }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? String(res.status))
      }
      return URL.createObjectURL(await res.blob())
    },
    [language],
  )

  /** Speaks sentence by sentence: the next one is synthesized while the current one plays. */
  const speak = useCallback(
    async (text: string) => {
      if (!status.data?.speak) return
      setState('speaking')
      setError(null)
      const parts = sentences(text)
      try {
        let next = synthesize(parts[0]!)
        for (let i = 0; i < parts.length; i++) {
          const url = await next
          if (i + 1 < parts.length) next = synthesize(parts[i + 1]!)
          const player = new Audio(url)
          audio.current = player
          await new Promise<void>((resolve) => {
            player.onended = () => resolve()
            player.onerror = () => resolve()
            void player.play().catch(() => resolve())
          })
          URL.revokeObjectURL(url)
          if (abort.current?.signal.aborted) break
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setState('idle')
      }
    },
    [status.data?.speak, synthesize],
  )

  const listen = useCallback(async () => {
    setError(null)
    abort.current = new AbortController()
    setState('listening')
    try {
      const wav = await recordAnswer({ signal: abort.current.signal })
      if (!wav) return null
      setState('transcribing')
      const { text } = await api.upload<{ text: string }>(
        `/api/voice/transcribe?language=${language}${application ? `&application=${application}` : ''}`,
        new File([wav], 'answer.wav', { type: 'audio/wav' }),
      )
      return text || null
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setState('idle')
    }
  }, [language, application])

  const v = t.voice
  return {
    available: Boolean(status.data?.speak && status.data?.listen),
    state,
    label:
      state === 'listening'
        ? v.listening
        : state === 'transcribing'
          ? v.transcribing
          : state === 'speaking'
            ? v.speaking
            : v.answer,
    error,
    listen,
    speak,
    stop,
  }
}

/** Text or voice, and the one-time install when the voice is missing. */
export function VoiceControls({
  voice,
  mode,
  onMode,
}: {
  voice: Voice
  mode: 'text' | 'voice'
  onMode: (m: 'text' | 'voice') => void
}) {
  const t = useT()
  const v = t.voice
  const status = useVoiceStatus()
  const [error, setError] = useState<string | null>(null)
  const s = status.data
  return (
    <div className="flex flex-col gap-2">
      <div className="flex self-start rounded-pill border border-border p-1" role="group" aria-label={v.mode}>
        {(['text', 'voice'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={m === 'voice' && !voice.available}
            onClick={() => onMode(m)}
            className={join(
              'flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm disabled:opacity-40',
              mode === m ? 'bg-surface-2 text-text' : 'text-muted hover:text-text',
            )}
          >
            {m === 'text' ? <Keyboard size={16} aria-hidden /> : <Microphone size={16} aria-hidden />}
            {m === 'text' ? v.text : v.voice}
          </button>
        ))}
      </div>
      {s && !voice.available && (
        <div className="flex flex-col gap-2 rounded-tile border border-border bg-bg p-3 text-sm">
          <p className="text-muted">{s.installing ? v.installing(s.progress) : v.notInstalled}</p>
          {!s.installing &&
            (s.installer ? (
              <Button
                size="small"
                variant="subtle"
                className="self-start"
                icon={<DownloadSimple size={16} />}
                onClick={async () => {
                  setError(null)
                  try {
                    await api.post('/api/voice/install')
                    await status.reload()
                  } catch (e) {
                    setError((e as Error).message)
                  }
                }}
              >
                {v.install}
              </Button>
            ) : (
              <p className="text-warning">{v.needsPython}</p>
            ))}
          <ErrorLine message={error ?? s.error} />
        </div>
      )}
    </div>
  )
}
