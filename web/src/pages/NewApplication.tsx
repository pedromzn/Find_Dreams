/**
 * New application: from a link (the server reads public job boards; LinkedIn and other login walls are refused) or
 * by pasting the whole job page (⌘A ⌘C): `parsePastedJob` finds the post and its facts in the copy, locally. Either
 * way the person reviews the fields and the post before anything is saved.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowSquareOut, CheckCircle, ClipboardText, DownloadSimple } from '@phosphor-icons/react'
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
import { parsePastedJob } from '@shared/pastedJob'
import { Button, ErrorLine, Field, Header, Input, Panel, Select, Tabs, TextArea } from '@/components/ui'
import { useT } from '@/i18n'
import { api, ApiError } from '@/lib/api'

type Mode = 'link' | 'text'

const today = () => new Date().toISOString().slice(0, 10)
const COPY_KEYS =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘A, ⌘C' : 'Ctrl+A, Ctrl+C'

type Found = Array<'role' | 'company' | 'location' | 'workModel' | 'salary'>

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
  const [pasted, setPasted] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [loginWall, setLoginWall] = useState(false)
  // what the last paste filled in: a new paste may replace those values, never what the person typed
  const [auto, setAuto] = useState<Partial<typeof form>>({})

  function readPaste(text: string) {
    setPasted(text)
    if (!text.trim()) {
      setFound(null)
      return
    }
    const job = parsePastedJob(text)
    const fill: Partial<typeof form> = {
      role: job.role,
      company: job.company,
      location: job.location,
      workModel: job.workModel ?? '',
      jobMarkdown: job.markdown,
      ...(job.source ? { source: job.source } : {}),
      ...(job.salary
        ? {
            salaryMin: String(job.salary.min ?? ''),
            salaryMax: String(job.salary.max ?? ''),
            currency: job.salary.currency,
            period: job.salary.period,
          }
        : {}),
    }
    const next: Partial<typeof form> = {}
    for (const [k, v] of Object.entries(fill) as Array<[keyof typeof form, string]>) {
      const current = form[k]
      if (v && (current === '' || current === auto[k] || k === 'jobMarkdown' || k === 'source')) {
        ;(next as Record<string, string>)[k] = v
      }
    }
    set(next)
    setAuto(fill)
    setFound(
      (['role', 'company', 'location', 'workModel', 'salary'] as const).filter((k) =>
        k === 'salary' ? job.salary !== null : k === 'workModel' ? job.workModel !== null : Boolean(job[k]),
      ),
    )
  }

  async function pasteFromClipboard() {
    setError(null)
    try {
      readPaste(await navigator.clipboard.readText())
    } catch {
      setError(n.clipboardDenied)
    }
  }

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
        // not an error to the person: the paste flow below takes it from here
        set({ url: link, source: /linkedin/.test(link) ? 'linkedin' : 'other' })
        setLoginWall(true)
        setMode('text')
      } else {
        setError((e as Error).message)
      }
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
      {mode === 'text' && (
        <Panel className="flex flex-col gap-4 p-5">
          {loginWall && (
            <div className="rounded-tile border border-st-applied/40 bg-st-applied/8 p-4">
              <p className="text-[14px] font-medium text-text">{n.linkedinTitle}</p>
              <ol className="mt-2 flex flex-col gap-1.5 text-[14px] text-muted">
                {n.linkedinSteps(COPY_KEYS).map((step, i) => (
                  <li key={step} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-st-applied/20 text-[12px] font-semibold text-st-applied">
                      {i + 1}
                    </span>
                    {step}
                    {i === 0 && form.url && (
                      <a
                        href={form.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13.5px] font-medium"
                      >
                        {n.openPost}
                        <ArrowSquareOut size={14} />
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="pasted" className="font-medium text-text">
                {n.pasteTitle}
              </label>
              <Button variant="subtle" size="small" icon={<ClipboardText size={16} />} onClick={pasteFromClipboard}>
                {n.pasteButton}
              </Button>
            </div>
            <p className="mt-1 text-[13px] text-faint">{n.pasteNote(COPY_KEYS)}</p>
          </div>
          <TextArea
            id="pasted"
            value={pasted}
            onChange={(e) => readPaste(e.target.value)}
            placeholder={n.pastePlaceholder}
            className="min-h-36"
          />
          {found &&
            (found.length > 0 ? (
              <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
                <CheckCircle size={17} weight="fill" className="text-success" aria-hidden />
                {n.found}
                {found.map((k) => (
                  <span
                    key={k}
                    className="rounded-pill border border-success/35 bg-success/8 px-2 py-0.5 text-[12.5px] text-success"
                  >
                    {n.foundFields[k]}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-[13.5px] text-warning">{n.notFound}</p>
            ))}
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
