/**
 * The debrief of a real interview: a guided form right after it (when, which stage, what they asked, how it went).
 * The account is saved in the person's words; the analysis and the adjustments for the next stages are the AI's.
 */

import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import type { CreatedRequest } from '@shared/api'
import { INTERVIEW_TYPES, type InterviewType } from '@shared/interviewTypes'
import { LANGUAGE_DATA, LANGUAGES, type Language } from '@shared/languages'
import { Button, ErrorLine, Field, Header, Input, Panel, Select, TextArea } from '@/components/ui'
import { useLanguage, useT } from '@/i18n'
import { api } from '@/lib/api'
import { HandOffDialog } from '@/agent/AgentActions'

const SELF = ['great', 'good', 'mixed', 'bad'] as const

export default function Debrief() {
  const { slug = '' } = useParams()
  const t = useT()
  const i = t.interview
  const uiLanguage = useLanguage((s) => s.language)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    interviewType: 'hr_screening' as InterviewType,
    account: '',
    questions: '',
    selfAssessment: '' as (typeof SELF)[number] | '',
    language: uiLanguage as Language,
  })
  const [created, setCreated] = useState<CreatedRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setCreated(
        await api.post<CreatedRequest>(`/api/applications/${slug}/debriefs`, {
          date: form.date,
          interviewType: form.interviewType,
          account: form.account,
          questionsAsked: form.questions
            .split('\n')
            .map((q) => q.trim())
            .filter(Boolean),
          ...(form.selfAssessment ? { selfAssessment: form.selfAssessment } : {}),
          language: form.language,
        }),
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Header title={i.debriefTitle} note={i.debriefNote} />
      <Panel className="p-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={i.date}>
              {(id) => (
                <Input id={id} type="date" required value={form.date} onChange={(e) => set({ date: e.target.value })} />
              )}
            </Field>
            <Field label={i.stage}>
              {(id) => (
                <Select
                  id={id}
                  value={form.interviewType}
                  onChange={(e) => set({ interviewType: e.target.value as InterviewType })}
                >
                  {INTERVIEW_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {t.interviewType[x]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={i.language}>
              {(id) => (
                <Select id={id} value={form.language} onChange={(e) => set({ language: e.target.value as Language })}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_DATA[l].name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={i.account}>
            {(id) => (
              <TextArea
                id={id}
                required
                value={form.account}
                onChange={(e) => set({ account: e.target.value })}
                className="min-h-40"
              />
            )}
          </Field>
          <Field label={i.questions}>
            {(id) => <TextArea id={id} value={form.questions} onChange={(e) => set({ questions: e.target.value })} />}
          </Field>
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-2 text-sm font-medium text-text">{i.self}</legend>
            {SELF.map((v) => (
              <label key={v} className="flex items-center gap-2 text-text">
                <input
                  type="radio"
                  name="self"
                  className="accent-[var(--accent)]"
                  checked={form.selfAssessment === v}
                  onChange={() => set({ selfAssessment: v })}
                />
                {i.selfOptions[v]}
              </label>
            ))}
          </fieldset>
          <ErrorLine message={error} />
          <Button type="submit" disabled={busy || !form.account.trim()} className="self-start">
            {busy ? t.general.saving : i.saveDebrief}
          </Button>
        </form>
      </Panel>
      <HandOffDialog created={created} onClose={() => window.history.back()} />
    </div>
  )
}
