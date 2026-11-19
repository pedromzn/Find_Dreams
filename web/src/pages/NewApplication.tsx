/**
 * New application: from a link (the server reads public job boards; LinkedIn and other login walls are refused) or
 * from pasted text. Either way the person reviews the fields and the post before anything is saved.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DownloadSimple } from '@phosphor-icons/react'
import type { CapturedJob } from '@shared/api'
import {
  SOURCES,
  STATUSES,
  type Application,
  type NewApplication as Form,
  type Source,
  type Status,
} from '@shared/application'
import { PAY_PERIODS, WORK_MODELS, type WorkModel } from '@shared/common'
import { Button, ErrorLine, Field, Header, Input, Panel, Select, Tabs, TextArea } from '@/components/ui'
import { useT } from '@/i18n'
import { api, ApiError } from '@/lib/api'

type Mode = 'link' | 'text'

const today = () => new Date().toISOString().slice(0, 10)

export default function NewApplication() {
  const t = useT()
  const n = t.newApplication
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('link')
  const [link, setLink] = useState('')
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    company: '',
    role: '',
    location: '',
    source: 'other' as Source,
    workModel: '' as WorkModel | '',
    status: 'saved' as Status,
    appliedAt: '',
    url: '',
    salaryMin: '',
    salaryMax: '',
    currency: 'BRL',
    period: 'month' as (typeof PAY_PERIODS)[number],
    jobMarkdown: '',
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  async function fetchJob() {
    setFetching(true)
    setError(null)
    try {
      const job = await api.post<CapturedJob>('/api/jobs/capture', { url: link })
      set({
        company: job.company || form.company,
        role: job.title || form.role,
        location: job.location,
        source: job.source,
        workModel: job.workModel ?? '',
        url: job.url,
        jobMarkdown: job.markdown,
      })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'login_required') {
        set({ url: link, source: /linkedin/.test(link) ? 'linkedin' : 'other' })
        setMode('text')
      }
      setError((e as Error).message)
    } finally {
      setFetching(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const min = form.salaryMin ? Number(form.salaryMin) : undefined
    const max = form.salaryMax ? Number(form.salaryMax) : undefined
    const body: Form = {
      company: form.company,
      role: form.role,
      source: form.source,
      status: form.status,
      location: form.location,
      jobMarkdown: form.jobMarkdown,
      ...(form.workModel ? { workModel: form.workModel } : {}),
      ...(form.url ? { url: form.url } : {}),
      ...(form.status !== 'saved' ? { appliedAt: form.appliedAt || today() } : {}),
      ...(min !== undefined || max !== undefined
        ? { salary: { min, max, currency: form.currency, period: form.period }, salaryKind: 'announced' as const }
        : {}),
    }
    try {
      const created = await api.post<Application>('/api/applications', body)
      navigate(`/applications/${created.slug}`)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Header title={n.title} note={n.note} />
      <Tabs<Mode>
        label={n.title}
        current={mode}
        onChange={setMode}
        tabs={[
          { id: 'link', label: n.fromLink },
          { id: 'text', label: n.fromText },
        ]}
      />
      {mode === 'link' && (
        <Panel className="flex flex-col gap-3 p-5">
          <Field label={n.link} hint={n.linkHint}>
            {(id) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://"
                />
                <Button
                  onClick={fetchJob}
                  disabled={!link.trim() || fetching}
                  icon={<DownloadSimple size={18} />}
                  className="shrink-0"
                >
                  {fetching ? n.fetching : n.fetch}
                </Button>
              </div>
            )}
          </Field>
        </Panel>
      )}
      <ErrorLine message={error} />

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel className="flex flex-col gap-4 p-5">
          <Field label={n.company}>
            {(id) => <Input id={id} required value={form.company} onChange={(e) => set({ company: e.target.value })} />}
          </Field>
          <Field label={n.role}>
            {(id) => <Input id={id} required value={form.role} onChange={(e) => set({ role: e.target.value })} />}
          </Field>
          <Field label={n.location}>
            {(id) => <Input id={id} value={form.location} onChange={(e) => set({ location: e.target.value })} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={n.source}>
              {(id) => (
                <Select id={id} value={form.source} onChange={(e) => set({ source: e.target.value as Source })}>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {t.source[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={n.workModel}>
              {(id) => (
                <Select
                  id={id}
                  value={form.workModel}
                  onChange={(e) => set({ workModel: e.target.value as WorkModel | '' })}
                >
                  <option value="">—</option>
                  {WORK_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {t.workModel[m]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={n.status}>
              {(id) => (
                <Select id={id} value={form.status} onChange={(e) => set({ status: e.target.value as Status })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t.status[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {form.status !== 'saved' && (
              <Field label={n.appliedAt}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={form.appliedAt || today()}
                    onChange={(e) => set({ appliedAt: e.target.value })}
                  />
                )}
              </Field>
            )}
          </div>
          <div className="grid grid-cols-[1fr_1fr_5rem_6rem] gap-2">
            <Field label={n.salaryMin}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={form.salaryMin}
                  onChange={(e) => set({ salaryMin: e.target.value })}
                />
              )}
            </Field>
            <Field label={n.salaryMax}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={form.salaryMax}
                  onChange={(e) => set({ salaryMax: e.target.value })}
                />
              )}
            </Field>
            <Field label={n.currency}>
              {(id) => (
                <Input
                  id={id}
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
                />
              )}
            </Field>
            <Field label={n.period}>
              {(id) => (
                <Select
                  id={id}
                  value={form.period}
                  onChange={(e) => set({ period: e.target.value as (typeof PAY_PERIODS)[number] })}
                >
                  {PAY_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {n.periods[p]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Button type="submit" disabled={saving || !form.company.trim() || !form.role.trim()}>
            {saving ? t.general.saving : n.create}
          </Button>
        </Panel>
        <Panel className="p-5">
          <Field label={n.jobText} hint={n.jobTextHint}>
            {(id) => (
              <TextArea
                id={id}
                value={form.jobMarkdown}
                onChange={(e) => set({ jobMarkdown: e.target.value })}
                className="min-h-[28rem] font-mono text-[13px]"
              />
            )}
          </Field>
        </Panel>
      </form>
    </div>
  )
}
