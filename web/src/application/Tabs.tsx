/**
 * The other tabs of an application: fit, company, messages, interviews and timeline. They show what the AI wrote (or
 * the empty state that says which file it will write), and what the person pasted.
 */

import { useState, type ReactNode } from 'react'
import { ChatCircleText, Buildings, Target, Microphone, ClockCounterClockwise } from '@phosphor-icons/react'
import type { ApplicationDetail } from '@shared/api'
import { Badge, Button, Empty, ErrorLine, Panel, Problems, TextArea } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { format, useT } from '@/i18n'
import { api } from '@/lib/api'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-sans text-sm font-medium tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  )
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="flex flex-col gap-1.5 text-text">
    {items.map((i) => (
      <li key={i}>• {i}</li>
    ))}
  </ul>
)

export function FitTab({ detail, actions }: { detail: ApplicationDetail; actions?: ReactNode }) {
  const t = useT()
  const fit = detail.fit
  if (!fit) {
    return (
      <div className="flex flex-col gap-4">
        <Problems problems={detail.fitProblems} file="fit.json" />
        <Empty icon={<Target size={32} />} title={t.application.noFit}>
          <p>{t.application.noFitNote}</p>
          {actions}
        </Empty>
      </div>
    )
  }
  return (
    <Panel className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-display text-5xl text-text">{fit.score}</span>
        <div className="min-w-0 flex-1">
          <div
            className="h-2 overflow-hidden rounded-pill bg-surface-2"
            role="progressbar"
            aria-valuenow={fit.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.application.fitScore}
          >
            <div className="h-full rounded-pill bg-accent" style={{ width: `${fit.score}%` }} />
          </div>
          <p className="mt-2 text-muted">{fit.scoreReason}</p>
        </div>
        {actions}
      </div>
      {fit.matches.length > 0 && (
        <Block title={t.application.matches}>
          <ul className="flex flex-col gap-2">
            {fit.matches.map((m) => (
              <li key={m.point}>
                <p className="text-text">{m.point}</p>
                <p className="text-sm text-faint">{m.evidence}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {fit.gaps.length > 0 && (
        <Block title={t.application.gaps}>
          <ul className="flex flex-col gap-2">
            {fit.gaps.map((g) => (
              <li key={g.point}>
                <p className="text-text">{g.point}</p>
                <p className="text-sm text-muted">→ {g.howToAddress}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {fit.talkingPoints.length > 0 && (
        <Block title={t.application.talkingPoints}>
          <Bullets items={fit.talkingPoints} />
        </Block>
      )}
      {fit.redFlags.length > 0 && (
        <Block title={t.application.redFlags}>
          <Bullets items={fit.redFlags} />
        </Block>
      )}
      {fit.questionsToAsk.length > 0 && (
        <Block title={t.application.questionsToAsk}>
          <Bullets items={fit.questionsToAsk} />
        </Block>
      )}
      <Block title={t.application.sources}>
        <ul className="flex flex-col gap-1 text-sm">
          {fit.sources.map((s) => (
            <li key={s.title}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
              ) : (
                <span className="text-muted">
                  {s.title} <code className="text-faint">{s.file}</code>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Block>
    </Panel>
  )
}

export function CompanyTab({ detail, actions }: { detail: ApplicationDetail; actions?: ReactNode }) {
  const t = useT()
  if (!detail.company) {
    return (
      <Empty icon={<Buildings size={32} />} title={t.application.noCompany}>
        <p>{t.application.noCompanyNote}</p>
        {actions}
      </Empty>
    )
  }
  return (
    <Panel className="flex flex-col gap-4 p-6">
      <Problems problems={detail.company.problems} file="company.md" />
      {actions}
      <Markdown text={detail.company.content} />
    </Panel>
  )
}

export function MessagesTab({
  detail,
  onSaved,
  actions,
}: {
  detail: ApplicationDetail
  onSaved: () => void
  actions?: (message: string) => ReactNode
}) {
  const t = useT()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function saveMessage() {
    setBusy(true)
    try {
      await api.post(`/api/applications/${detail.slug}/messages`, { text })
      setText('')
      setError(null)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Panel className="flex flex-col gap-3 p-5">
        <h3 className="font-sans text-sm font-medium text-text">{t.application.pasteMessage}</h3>
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t.application.pasteMessage}
          className="min-h-48"
        />
        <p className="text-xs text-faint">{t.application.pasteMessageNote}</p>
        <ErrorLine message={error} />
        <Button onClick={saveMessage} disabled={!text.trim() || busy}>
          {busy ? t.general.saving : t.application.saveMessage}
        </Button>
      </Panel>
      <div className="flex flex-col gap-3">
        {detail.messages.length === 0 ? (
          <Empty icon={<ChatCircleText size={32} />} title={t.application.noMessages} />
        ) : (
          [...detail.messages].reverse().map((m) => (
            <Panel key={m.name} className="p-5">
              <p className="mb-2 font-mono text-xs text-faint">{m.name}</p>
              <Markdown text={m.content} />
              {m.drafts && (
                <div className="mt-4 rounded-tile border border-border bg-bg p-4">
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{t.agent.drafts}</p>
                  <Problems problems={m.drafts.problems} file={m.drafts.name} />
                  <Markdown text={m.drafts.content} />
                </div>
              )}
              {actions?.(m.name)}
            </Panel>
          ))
        )}
      </div>
    </div>
  )
}

export function InterviewsTab({ detail, actions }: { detail: ApplicationDetail; actions?: ReactNode }) {
  const t = useT()
  const empty = !detail.interviews.length && !detail.debriefs.length && !detail.personas.length
  return (
    <div className="flex flex-col gap-6">
      {actions}
      {empty && <Empty icon={<Microphone size={32} />} title={t.application.noInterviews} />}
      {detail.personas.length > 0 && (
        <Block title={t.application.personas}>
          <div className="grid gap-3 sm:grid-cols-2">
            {detail.personas.map((p) => (
              <Panel key={p.id} className="p-4">
                {p.persona ? (
                  <>
                    <p className="text-text">{p.persona.role}</p>
                    <p className="text-sm text-muted">
                      {t.interviewType[p.persona.interviewType]} · {p.persona.tone}
                    </p>
                  </>
                ) : (
                  <Problems problems={p.problems} file={`interviewers/${p.id}.json`} />
                )}
              </Panel>
            ))}
          </div>
        </Block>
      )}
      {detail.interviews.length > 0 && (
        <Block title={t.application.practice}>
          <div className="flex flex-col gap-3">
            {detail.interviews.map((i) => (
              <Panel key={i.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-text">
                    {i.session ? t.interviewType[i.session.interviewType] : i.id}
                    <span className="ml-2 text-sm text-faint">{i.id.slice(0, 10)}</span>
                  </p>
                  {i.feedback && (
                    <Badge tone="accent">
                      {(i.feedback.scores.reduce((sum, s) => sum + s.score, 0) / i.feedback.scores.length).toFixed(1)} /
                      5
                    </Badge>
                  )}
                </div>
                {i.feedback && <p className="mt-2 text-sm text-muted">{i.feedback.overall}</p>}
                <Problems problems={i.problems} />
              </Panel>
            ))}
          </div>
        </Block>
      )}
      {detail.debriefs.length > 0 && (
        <Block title={t.application.debriefs}>
          <div className="flex flex-col gap-3">
            {detail.debriefs.map((d) => (
              <Panel key={d.id} className="p-4">
                {d.debrief ? (
                  <>
                    <p className="text-text">
                      {t.interviewType[d.debrief.interviewType]}
                      <span className="ml-2 text-sm text-faint">{format.date(d.debrief.date)}</span>
                    </p>
                    <p className="mt-2 text-sm text-muted">{d.debrief.account}</p>
                  </>
                ) : (
                  <Problems problems={d.problems} file={`debriefs/${d.id}.json`} />
                )}
              </Panel>
            ))}
          </div>
        </Block>
      )}
    </div>
  )
}

export function TimelineTab({ detail }: { detail: ApplicationDetail }) {
  const t = useT()
  if (!detail.timeline.length)
    return <Empty icon={<ClockCounterClockwise size={32} />} title={t.application.noTimeline} />
  const label = (kind: string, value: string) => {
    if (kind === 'status') return t.status[value as keyof typeof t.status] ?? value
    if (kind === 'stage' || kind === 'simulation' || kind === 'debrief')
      return t.interviewType[value as keyof typeof t.interviewType] ?? value
    return value
  }
  return (
    <Panel className="p-6">
      <ol className="relative flex flex-col gap-5 border-l border-border pl-6">
        {detail.timeline.map((e, i) => (
          <li key={`${e.at}-${e.kind}-${i}`} className="relative">
            <span className="absolute top-1.5 -left-[29px] h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <p className="text-xs text-faint">{format.date(e.at)}</p>
            <p className="text-text">
              {t.timeline[e.kind]}: <span className="text-muted">{label(e.kind, e.label)}</span>
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
