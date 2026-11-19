/**
 * The summary of one application: the details, pros and cons, next steps, interview stages, contacts and notes —
 * each edited in place and saved with a PATCH of only that field (the AI may be editing the rest of the file).
 */

import { useState, type ReactNode } from 'react'
import { ArrowSquareOut, Plus, Trash } from '@phosphor-icons/react'
import type { ApplicationDetail } from '@shared/api'
import { STAGE_RESULTS, type Application, type ApplicationPatch } from '@shared/application'
import { INTERVIEW_TYPES, type InterviewType } from '@shared/interviewTypes'
import { Button, ErrorLine, Input, Panel, Select, TextArea } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { format, useT } from '@/i18n'
import { LANGUAGE_DATA } from '@shared/languages'
import { useLanguage } from '@/i18n'
import { formatPay } from './labels'

export type Save = (patch: ApplicationPatch) => Promise<void>

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Panel className={className ? `p-5 ${className}` : 'p-5'}>
      <h2 className="mb-3 font-sans text-sm font-medium tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </Panel>
  )
}

/** A list of short sentences with add and remove (pros, cons). */
function SentenceList({
  items,
  onChange,
  addLabel,
}: {
  items: string[]
  onChange: (v: string[]) => void
  addLabel: string
}) {
  const [draft, setDraft] = useState('')
  const t = useT()
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={`${item}-${i}`} className="group flex items-start justify-between gap-2 text-text">
            <span>• {item}</span>
            <button
              type="button"
              className="text-faint opacity-60 hover:text-danger group-hover:opacity-100"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`${t.general.delete}: ${item}`}
            >
              <Trash size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          onChange([...items, draft.trim()])
          setDraft('')
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={addLabel} aria-label={addLabel} />
        <Button type="submit" variant="subtle" size="small" className="h-auto" aria-label={addLabel}>
          <Plus size={16} />
        </Button>
      </form>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 text-text">{children}</dd>
    </div>
  )
}

export function SummaryTab({ detail, a, save }: { detail: ApplicationDetail; a: Application; save: Save }) {
  const t = useT()
  const locale = LANGUAGE_DATA[useLanguage((s) => s.language)].bcp47
  const [notes, setNotes] = useState(a.notes)
  const [step, setStep] = useState({ what: '', due: '' })
  const [stage, setStage] = useState<{ type: InterviewType; date: string }>({ type: 'hr_screening', date: '' })
  const [contact, setContact] = useState({ name: '', role: '' })
  const [error, setError] = useState<string | null>(null)

  const run = (patch: ApplicationPatch) =>
    save(patch).then(
      () => setError(null),
      (e: Error) => setError(e.message),
    )

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <ErrorLine message={error} />
        <Section title={t.application.details}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {a.salary && (
              <Fact label={t.application.salary}>
                {formatPay(a.salary, locale, t.newApplication.periods[a.salary.period])}
                {a.salaryKind && (
                  <span className="block text-xs text-faint">
                    {a.salaryKind === 'announced' ? t.application.salaryAnnounced : t.application.salaryInformed}
                  </span>
                )}
              </Fact>
            )}
            {a.location && <Fact label={t.application.location}>{a.location}</Fact>}
            {a.workModel && <Fact label={t.newApplication.workModel}>{t.workModel[a.workModel]}</Fact>}
            {a.contract && <Fact label={t.application.contract}>{t.contract[a.contract]}</Fact>}
            {a.seniority && <Fact label={t.application.seniority}>{t.seniority[a.seniority]}</Fact>}
            <Fact label={t.application.source}>{t.source[a.source]}</Fact>
            {a.appliedAt && <Fact label={t.application.applied}>{format.date(a.appliedAt)}</Fact>}
            {a.url && (
              <Fact label={t.application.link}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                  {new URL(a.url).hostname}
                  <ArrowSquareOut size={14} aria-hidden />
                </a>
              </Fact>
            )}
          </dl>
        </Section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Section title={t.application.pros}>
            <SentenceList items={a.pros} onChange={(pros) => run({ pros })} addLabel={t.application.addPro} />
          </Section>
          <Section title={t.application.cons}>
            <SentenceList items={a.cons} onChange={(cons) => run({ cons })} addLabel={t.application.addCon} />
          </Section>
        </div>

        <Section title={t.application.job}>
          {detail.job ? <Markdown text={detail.job.content} /> : <p className="text-muted">{t.application.noJob}</p>}
        </Section>
      </div>

      <div className="flex flex-col gap-4">
        <Section title={t.application.nextSteps}>
          <ul className="flex flex-col gap-2">
            {a.nextSteps.map((s, i) => (
              <li key={`${s.what}-${i}`} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={s.done}
                  className="mt-1 accent-[var(--accent)]"
                  aria-label={s.what}
                  onChange={() =>
                    run({ nextSteps: a.nextSteps.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })
                  }
                />
                <span className={s.done ? 'text-faint line-through' : 'text-text'}>
                  {s.what}
                  {s.due && <span className="block text-xs text-faint">{format.date(s.due)}</span>}
                </span>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!step.what.trim()) return
              void run({
                nextSteps: [
                  ...a.nextSteps,
                  { what: step.what.trim(), ...(step.due ? { due: step.due } : {}), done: false },
                ],
              })
              setStep({ what: '', due: '' })
            }}
          >
            <Input
              value={step.what}
              onChange={(e) => setStep({ ...step, what: e.target.value })}
              placeholder={t.application.stepPlaceholder}
              aria-label={t.application.addStep}
            />
            <div className="flex flex-col gap-2">
              <Input
                type="date"
                value={step.due}
                onChange={(e) => setStep({ ...step, due: e.target.value })}
                aria-label={t.application.addStep}
              />
              <Button type="submit" variant="subtle" size="small">
                {t.application.addStep}
              </Button>
            </div>
          </form>
        </Section>

        <Section title={t.application.stages}>
          <ul className="flex flex-col gap-2">
            {a.stages.map((s, i) => (
              <li key={`${s.type}-${i}`} className="flex items-center justify-between gap-2">
                <span className="text-text">
                  {t.interviewType[s.type]}
                  {s.date && <span className="block text-xs text-faint">{format.date(s.date)}</span>}
                </span>
                <Select
                  value={s.result}
                  className="w-40 shrink-0 py-1.5 text-sm"
                  aria-label={t.interviewType[s.type]}
                  onChange={(e) =>
                    run({
                      stages: a.stages.map((x, j) =>
                        j === i ? { ...x, result: e.target.value as (typeof STAGE_RESULTS)[number] } : x,
                      ),
                    })
                  }
                >
                  {STAGE_RESULTS.map((r) => (
                    <option key={r} value={r}>
                      {t.stageResult[r]}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void run({
                stages: [
                  ...a.stages,
                  { type: stage.type, ...(stage.date ? { date: stage.date } : {}), result: 'scheduled', notes: '' },
                ],
              })
              setStage({ type: 'hr_screening', date: '' })
            }}
          >
            <Select
              value={stage.type}
              onChange={(e) => setStage({ ...stage, type: e.target.value as InterviewType })}
              aria-label={t.application.addStage}
            >
              {INTERVIEW_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.interviewType[type]}
                </option>
              ))}
            </Select>
            <div className="flex flex-col gap-2">
              <Input
                type="date"
                value={stage.date}
                onChange={(e) => setStage({ ...stage, date: e.target.value })}
                aria-label={t.application.addStage}
              />
              <Button type="submit" variant="subtle" size="small">
                {t.application.addStage}
              </Button>
            </div>
          </form>
        </Section>

        <Section title={t.application.contacts}>
          <ul className="flex flex-col gap-1.5">
            {a.contacts.map((c, i) => (
              <li key={`${c.name}-${i}`} className="flex items-center justify-between gap-2">
                <span className="text-text">
                  {c.name} <span className="text-sm text-muted">· {c.role}</span>
                </span>
                <button
                  type="button"
                  className="text-faint hover:text-danger"
                  onClick={() => run({ contacts: a.contacts.filter((_, j) => j !== i) })}
                  aria-label={`${t.general.delete}: ${c.name}`}
                >
                  <Trash size={14} />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!contact.name.trim() || !contact.role.trim()) return
              void run({ contacts: [...a.contacts, { name: contact.name.trim(), role: contact.role.trim() }] })
              setContact({ name: '', role: '' })
            }}
          >
            <Input
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              placeholder={t.application.contactName}
              aria-label={t.application.contactName}
            />
            <Input
              value={contact.role}
              onChange={(e) => setContact({ ...contact, role: e.target.value })}
              placeholder={t.application.contactRole}
              aria-label={t.application.contactRole}
            />
            <Button type="submit" variant="subtle" size="small">
              {t.application.addContact}
            </Button>
            <p className="text-xs text-faint">{t.application.contactNote}</p>
          </form>
        </Section>

        <Section title={t.application.notes}>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label={t.application.notes} />
          {notes !== a.notes && (
            <Button size="small" className="mt-2" onClick={() => run({ notes })}>
              {t.general.save}
            </Button>
          )}
        </Section>
      </div>
    </div>
  )
}
