/** The profile form and the CV editor, shared by the Profile screen and the first-run Welcome. */

import { useRef, useState, type FormEvent } from 'react'
import { FileArrowUp, Plus, Trash } from '@phosphor-icons/react'
import { LANGUAGE_LEVELS, SKILL_LEVELS, type Profile } from '@shared/profile'
import { PAY_PERIODS, WORK_MODELS } from '@shared/common'
import { Button, ErrorLine, Field, Input, Panel, Select, TextArea } from '@/components/ui'
import { useT } from '@/i18n'
import { api } from '@/lib/api'

type Draft = {
  name: string
  headline: string
  location: string
  stack: Array<{ name: string; level: (typeof SKILL_LEVELS)[number]; years: string }>
  languages: Array<{ language: string; level: (typeof LANGUAGE_LEVELS)[number] }>
  workModels: string[]
  relocation: boolean
  salaryMin: string
  salaryMax: string
  currency: string
  period: (typeof PAY_PERIODS)[number]
  links: Array<{ label: string; url: string }>
}

function toDraft(p: Profile | null): Draft {
  return {
    name: p?.name ?? '',
    headline: p?.headline ?? '',
    location: p?.location ?? '',
    stack: (p?.stack ?? []).map((s) => ({ ...s, years: String(s.years) })),
    languages: p?.languages ?? [],
    workModels: p?.workModels ?? [...WORK_MODELS],
    relocation: p?.relocation ?? false,
    salaryMin: p?.salaryExpectation?.min?.toString() ?? '',
    salaryMax: p?.salaryExpectation?.max?.toString() ?? '',
    currency: p?.salaryExpectation?.currency ?? 'BRL',
    period: p?.salaryExpectation?.period ?? 'month',
    links: p?.links ?? [],
  }
}

function fromDraft(d: Draft) {
  const min = d.salaryMin ? Number(d.salaryMin) : undefined
  const max = d.salaryMax ? Number(d.salaryMax) : undefined
  return {
    name: d.name,
    headline: d.headline,
    location: d.location,
    stack: d.stack.filter((s) => s.name.trim()).map((s) => ({ ...s, years: Number(s.years) || 0 })),
    languages: d.languages.filter((l) => l.language.trim()),
    workModels: d.workModels,
    relocation: d.relocation,
    ...(min !== undefined || max !== undefined
      ? { salaryExpectation: { min, max, currency: d.currency, period: d.period } }
      : {}),
    links: d.links.filter((l) => l.url.trim()),
  }
}

export function ProfileForm({
  profile,
  onSaved,
  submitLabel,
}: {
  profile: Profile | null
  onSaved: () => void
  submitLabel?: string
}) {
  const t = useT()
  const p = t.profile
  const [d, setD] = useState(() => toDraft(profile))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/api/profile', fromDraft(d))
      setError(null)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={p.name}>
          {(id) => <Input id={id} required value={d.name} onChange={(e) => set({ name: e.target.value })} />}
        </Field>
        <Field label={p.location}>
          {(id) => <Input id={id} value={d.location} onChange={(e) => set({ location: e.target.value })} />}
        </Field>
        <Field label={p.headline} hint={p.headlineHint} className="sm:col-span-2">
          {(id) => <Input id={id} value={d.headline} onChange={(e) => set({ headline: e.target.value })} />}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-text">{p.stack}</legend>
        {d.stack.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_9rem_5rem_auto] gap-2">
            <Input
              aria-label={p.stackName}
              placeholder={p.stackName}
              value={s.name}
              onChange={(e) => set({ stack: d.stack.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
            />
            <Select
              aria-label={p.level}
              value={s.level}
              onChange={(e) =>
                set({
                  stack: d.stack.map((x, j) =>
                    j === i ? { ...x, level: e.target.value as Draft['stack'][number]['level'] } : x,
                  ),
                })
              }
            >
              {SKILL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {p.levels[l]}
                </option>
              ))}
            </Select>
            <Input
              aria-label={p.years}
              type="number"
              min={0}
              max={50}
              value={s.years}
              onChange={(e) => set({ stack: d.stack.map((x, j) => (j === i ? { ...x, years: e.target.value } : x)) })}
            />
            <Button
              variant="ghost"
              size="small"
              aria-label={p.remove}
              onClick={() => set({ stack: d.stack.filter((_, j) => j !== i) })}
            >
              <Trash size={16} />
            </Button>
          </div>
        ))}
        <Button
          variant="subtle"
          size="small"
          className="self-start"
          icon={<Plus size={16} />}
          onClick={() => set({ stack: [...d.stack, { name: '', level: 'intermediate', years: '1' }] })}
        >
          {p.addStack}
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-text">{p.languages}</legend>
        {d.languages.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_10rem_auto] gap-2">
            <Input
              aria-label={p.language}
              placeholder={p.language}
              value={l.language}
              onChange={(e) =>
                set({ languages: d.languages.map((x, j) => (j === i ? { ...x, language: e.target.value } : x)) })
              }
            />
            <Select
              aria-label={p.level}
              value={l.level}
              onChange={(e) =>
                set({
                  languages: d.languages.map((x, j) =>
                    j === i ? { ...x, level: e.target.value as Draft['languages'][number]['level'] } : x,
                  ),
                })
              }
            >
              {LANGUAGE_LEVELS.map((v) => (
                <option key={v} value={v}>
                  {p.languageLevels[v]}
                </option>
              ))}
            </Select>
            <Button
              variant="ghost"
              size="small"
              aria-label={p.remove}
              onClick={() => set({ languages: d.languages.filter((_, j) => j !== i) })}
            >
              <Trash size={16} />
            </Button>
          </div>
        ))}
        <Button
          variant="subtle"
          size="small"
          className="self-start"
          icon={<Plus size={16} />}
          onClick={() => set({ languages: [...d.languages, { language: '', level: 'intermediate' }] })}
        >
          {p.addLanguage}
        </Button>
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-4">
        <legend className="mb-2 text-sm font-medium text-text">{p.workModels}</legend>
        {WORK_MODELS.map((m) => (
          <label key={m} className="flex items-center gap-2 text-text">
            <input
              type="checkbox"
              className="accent-[var(--accent)]"
              checked={d.workModels.includes(m)}
              onChange={(e) =>
                set({ workModels: e.target.checked ? [...d.workModels, m] : d.workModels.filter((x) => x !== m) })
              }
            />
            {t.workModel[m]}
          </label>
        ))}
        <label className="flex items-center gap-2 text-text">
          <input
            type="checkbox"
            className="accent-[var(--accent)]"
            checked={d.relocation}
            onChange={(e) => set({ relocation: e.target.checked })}
          />
          {p.relocation}
        </label>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text">{p.salary}</legend>
        <div className="grid grid-cols-[1fr_1fr_5rem_6rem] gap-2">
          <Input
            aria-label={t.newApplication.salaryMin}
            placeholder={t.newApplication.salaryMin}
            type="number"
            min={0}
            value={d.salaryMin}
            onChange={(e) => set({ salaryMin: e.target.value })}
          />
          <Input
            aria-label={t.newApplication.salaryMax}
            placeholder={t.newApplication.salaryMax}
            type="number"
            min={0}
            value={d.salaryMax}
            onChange={(e) => set({ salaryMax: e.target.value })}
          />
          <Input
            aria-label={t.newApplication.currency}
            maxLength={3}
            value={d.currency}
            onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
          />
          <Select
            aria-label={t.newApplication.period}
            value={d.period}
            onChange={(e) => set({ period: e.target.value as Draft['period'] })}
          >
            {PAY_PERIODS.map((x) => (
              <option key={x} value={x}>
                {t.newApplication.periods[x]}
              </option>
            ))}
          </Select>
        </div>
        <p className="mt-1.5 text-sm text-faint">{p.salaryHint}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-text">{p.links}</legend>
        {d.links.map((l, i) => (
          <div key={i} className="grid grid-cols-[10rem_1fr_auto] gap-2">
            <Input
              aria-label={p.linkLabel}
              placeholder={p.linkLabel}
              value={l.label}
              onChange={(e) => set({ links: d.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
            />
            <Input
              aria-label={p.linkUrl}
              placeholder="https://"
              type="url"
              value={l.url}
              onChange={(e) => set({ links: d.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
            />
            <Button
              variant="ghost"
              size="small"
              aria-label={p.remove}
              onClick={() => set({ links: d.links.filter((_, j) => j !== i) })}
            >
              <Trash size={16} />
            </Button>
          </div>
        ))}
        <Button
          variant="subtle"
          size="small"
          className="self-start"
          icon={<Plus size={16} />}
          onClick={() => set({ links: [...d.links, { label: 'GitHub', url: '' }] })}
        >
          {p.addLink}
        </Button>
      </fieldset>

      <ErrorLine message={error} />
      <Button type="submit" disabled={saving || !d.name.trim()} className="self-start">
        {saving ? t.general.saving : (submitLabel ?? t.general.save)}
      </Button>
    </form>
  )
}

export function CvEditor({
  cv,
  onSaved,
  submitLabel,
}: {
  cv: string | null
  onSaved: () => void
  submitLabel?: string
}) {
  const t = useT()
  const p = t.profile
  const [text, setText] = useState(cv ?? '')
  const [busy, setBusy] = useState<'import' | 'save' | null>(null)
  const [imported, setImported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function importFile(file: File) {
    setBusy('import')
    setError(null)
    try {
      const { markdown } = await api.upload<{ markdown: string }>('/api/profile/cv/import', file)
      setText(markdown)
      setImported(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  async function save() {
    setBusy('save')
    try {
      await api.put('/api/profile/cv', { markdown: text })
      setError(null)
      setImported(false)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])}
        />
        <Button
          variant="subtle"
          icon={<FileArrowUp size={18} />}
          onClick={() => input.current?.click()}
          disabled={busy !== null}
        >
          {busy === 'import' ? p.importing : p.importCv}
        </Button>
        {imported && <p className="text-sm text-warning">{p.importedNote}</p>}
      </div>
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={p.cv}
        placeholder={p.noCv}
        className="min-h-96 font-mono text-[13px]"
      />
      <ErrorLine message={error} />
      <Button onClick={save} disabled={!text.trim() || busy !== null} className="self-start">
        {busy === 'save' ? t.general.saving : (submitLabel ?? p.saveCv)}
      </Button>
    </div>
  )
}

export function ProfilePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="p-6">
      <h2 className="mb-4 text-xl">{title}</h2>
      {children}
    </Panel>
  )
}
