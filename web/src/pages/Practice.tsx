/**
 * A practice interview: choose the stage, the interviewer (prepared by the agent, or a generic one), the language and
 * the conversation engine; then talk, turn by turn. Ending saves the transcript and hands the feedback to the AI.
 *
 * The voice mode (phase 6) plugs into the same conversation: `useVoice` turns the microphone into the text of a turn
 * and speaks the interviewer's answer.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Microphone, PaperPlaneRight, Stop, UserCircle } from '@phosphor-icons/react'
import type { ApplicationDetail, CreatedRequest } from '@shared/api'
import { INTERVIEW_TYPES, type InterviewType } from '@shared/interviewTypes'
import { LANGUAGE_DATA, LANGUAGES, type Language } from '@shared/languages'
import {
  Badge,
  Button,
  ErrorLine,
  Field,
  Header,
  Loading,
  Panel,
  ScreenError,
  Select,
  TextArea,
  join,
} from '@/components/ui'
import { useLanguage, useT } from '@/i18n'
import { api, useData } from '@/lib/api'
import { HandOffDialog, useHandOff } from '@/agent/AgentActions'
import { VoiceControls, useVoice } from '@/voice/useVoice'

type Brain = 'auto' | 'ollama' | 'acp' | 'api'
type Turn = { speaker: 'interviewer' | 'candidate'; text: string; latencyMs?: number }
type TurnResult = {
  id: string
  folder: string
  say: string
  intent: string
  latencyMs: number
  engine: string
  personaPrepared: boolean
}

const SLOW_MS = 4000

export default function Practice() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const t = useT()
  const i = t.interview
  const uiLanguage = useLanguage((s) => s.language)
  const detail = useData<ApplicationDetail>(`/api/applications/${slug}`)
  const brainInfo = useData<{ choice: Brain }>('/api/brain')
  const [type, setType] = useState<InterviewType>((params.get('type') as InterviewType) || 'hr_screening')
  const [persona, setPersona] = useState('')
  const [language, setLanguage] = useState<Language>(uiLanguage)
  const [brain, setBrain] = useState<Brain>('auto')
  const [mode, setMode] = useState<'text' | 'voice'>('text')
  const [session, setSession] = useState<{ id: string; folder: string; engine: string } | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState<CreatedRequest | null>(null)
  const [handOff, setHandOff] = useState(true)
  const end = useRef<HTMLDivElement>(null)
  const prepare = useHandOff(detail.reload)
  const voice = useVoice(language, slug)

  useEffect(() => {
    if (brainInfo.data) setBrain(brainInfo.data.choice)
  }, [brainInfo.data])
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [turns, busy])

  if (detail.error) return <ScreenError error={detail.error} onRetry={detail.reload} />
  if (!detail.data) return <Loading />
  const personas = detail.data.personas.filter((p) => p.persona?.interviewType === type)
  const slow = turns.filter((x) => x.latencyMs !== undefined && x.latencyMs > SLOW_MS).length >= 2

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<TurnResult>('/api/interviews', {
        application: slug,
        interviewType: type,
        ...(persona ? { persona } : {}),
        language,
        mode,
        brain,
      })
      setSession({ id: r.id, folder: r.folder, engine: r.engine })
      setTurns([{ speaker: 'interviewer', text: r.say, latencyMs: r.latencyMs }])
      if (mode === 'voice') await voice.speak(r.say)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function send(text: string) {
    if (!session || !text.trim() || busy) return
    setBusy(true)
    setError(null)
    setTurns((x) => [...x, { speaker: 'candidate', text: text.trim() }])
    setDraft('')
    try {
      const r = await api.post<TurnResult>(`/api/interviews/${session.id}/turns`, { text })
      setTurns((x) => [...x, { speaker: 'interviewer', text: r.say, latencyMs: r.latencyMs }])
      if (mode === 'voice') await voice.speak(r.say)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    if (!session) return
    setBusy(true)
    try {
      voice.stop()
      setEnded(await api.post<CreatedRequest>(`/api/interviews/${session.id}/end`, { language }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(draft)
    }
  }

  if (!session) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <Header title={i.setupTitle} note={i.setupNote} />
        <p className="text-muted">
          {detail.data.application?.company} · {detail.data.application?.role}
        </p>
        <Panel className="flex flex-col gap-4 p-6">
          <Field label={i.stage}>
            {(id) => (
              <Select
                id={id}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as InterviewType)
                  setPersona('')
                }}
              >
                {INTERVIEW_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t.interviewType[x]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={i.interviewer}>
            {(id) => (
              <Select id={id} value={persona} onChange={(e) => setPersona(e.target.value)}>
                <option value="">{i.generic}</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.persona?.role}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {personas.length === 0 && (
            <div className="flex flex-col gap-2 rounded-tile border border-border bg-bg p-4">
              <p className="text-sm text-muted">{i.noPersona}</p>
              <Button
                variant="subtle"
                size="small"
                className="self-start"
                disabled={prepare.busy}
                onClick={() => prepare.start('prepare-interview', { application: slug, interviewType: type })}
              >
                {i.prepare}
              </Button>
              <ErrorLine message={prepare.error} />
              {prepare.dialog}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={i.language}>
              {(id) => (
                <Select id={id} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_DATA[l].name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={i.brain} hint={i.brainNote}>
              {(id) => (
                <Select id={id} value={brain} onChange={(e) => setBrain(e.target.value as Brain)}>
                  {(['auto', 'ollama', 'acp', 'api'] as const).map((b) => (
                    <option key={b} value={b}>
                      {i.brains[b]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <VoiceControls voice={voice} mode={mode} onMode={setMode} />
          <ErrorLine message={error} />
          <Button onClick={start} disabled={busy} className="self-start">
            {busy ? i.starting : i.start}
          </Button>
        </Panel>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {detail.data.application?.company} · {t.interviewType[type]}
          </p>
          <h1 className="text-2xl">{i.setupTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{i.brains[session.engine as Brain] ?? session.engine}</Badge>
          {!ended && (
            <Button variant="subtle" size="small" icon={<Stop size={16} />} onClick={finish} disabled={busy}>
              {i.end}
            </Button>
          )}
        </div>
      </header>
      {slow && <p className="text-sm text-warning">{i.slow}</p>}

      <Panel className="flex flex-col gap-4 p-5" as="div">
        <ol className="flex flex-col gap-4" aria-live="polite">
          {turns.map((turn, n) => (
            <li
              key={n}
              className={join('flex flex-col gap-1', turn.speaker === 'candidate' ? 'items-end' : 'items-start')}
            >
              <span className="flex items-center gap-1.5 text-xs text-faint">
                {turn.speaker === 'interviewer' ? <UserCircle size={14} aria-hidden /> : null}
                {turn.speaker === 'interviewer' ? i.interviewer : i.you}
                {turn.latencyMs !== undefined && <span>· {i.latency(turn.latencyMs)}</span>}
              </span>
              <p
                className={join(
                  'max-w-[85%] rounded-tile px-4 py-2.5 whitespace-pre-wrap',
                  turn.speaker === 'interviewer' ? 'bg-surface-2 text-text' : 'bg-accent text-on-accent',
                )}
              >
                {turn.text}
              </p>
            </li>
          ))}
          {busy && <li className="text-sm text-muted">{i.thinking}</li>}
        </ol>
        <div ref={end} />
      </Panel>

      {ended ? (
        <Panel className="flex flex-col gap-3 p-5">
          <p className="text-text">{i.ended}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" size="small" onClick={() => setHandOff(true)}>
              {i.getFeedback}
            </Button>
            <Link to={`/applications/${slug}/interviews/${session.folder}`} className="self-center text-sm">
              {i.open}
            </Link>
          </div>
          <HandOffDialog created={handOff ? ended : null} onClose={() => setHandOff(false)} />
        </Panel>
      ) : mode === 'voice' ? (
        <Panel className="flex flex-col items-center gap-3 p-5">
          <Button
            size="large"
            icon={<Microphone size={20} weight="fill" />}
            disabled={busy || voice.state !== 'idle'}
            onClick={async () => {
              const text = await voice.listen()
              if (text) await send(text)
            }}
          >
            {voice.label}
          </Button>
          <ErrorLine message={error ?? voice.error} />
        </Panel>
      ) : (
        <Panel className="flex flex-col gap-2 p-4">
          <TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={i.yourAnswer}
            aria-label={i.yourAnswer}
            className="min-h-28"
            disabled={busy}
            autoFocus
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-faint">{i.sendHint}</p>
            <Button onClick={() => send(draft)} disabled={busy || !draft.trim()} icon={<PaperPlaneRight size={16} />}>
              {i.send}
            </Button>
          </div>
          <ErrorLine message={error} />
        </Panel>
      )}
    </div>
  )
}
