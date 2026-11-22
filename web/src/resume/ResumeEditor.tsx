/**
 * Editing a résumé by hand: a form on the left, the page in its template on the right, updated as the person types.
 * The draft is checked with the same schema the server (and the AI) use before it is saved; the server marks the file
 * `editedAt`, so the AI starts from these edits when it rebuilds or tailors the résumé later.
 */

import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, CaretDown, Plus, Trash } from '@phosphor-icons/react'
import { resumeSchema, type Resume } from '@shared/resume'
import { Button, ErrorLine, Input, TextArea, join } from '@/components/ui'
import { useT } from '@/i18n'
import { api } from '@/lib/api'
import { ResumeView } from './ResumeView'

type Experience = Resume['experience'][number]
type Education = Resume['education'][number]

/** Empty optional fields become absent: an empty e-mail or date is "not given", not an invalid value. */
function clean(r: Resume): Resume {
  const opt = <T,>(v: T | '' | undefined) => (v === '' ? undefined : v)
  return {
    ...r,
    basics: {
      ...r.basics,
      email: opt(r.basics.email),
      links: r.basics.links.filter((l) => l.label.trim() || l.url.trim()),
    },
    experience: r.experience.map((e) => ({
      ...e,
      start: opt(e.start),
      end: e.current ? undefined : opt(e.end),
      bullets: e.bullets.map((b) => b.trim()).filter(Boolean),
    })),
    education: r.education.map((e) => ({ ...e, start: opt(e.start), end: opt(e.end) })),
    skills: r.skills
      .map((s) => ({ ...s, items: s.items.map((i) => i.trim()).filter(Boolean) }))
      .filter((s) => s.group.trim() || s.items.length),
    projects: r.projects.map((p) => ({ ...p, url: opt(p.url) })),
  }
}

function Group({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-tile border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14.5px] font-semibold text-text select-none">
        {title}
        <CaretDown size={16} className="text-faint transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-4">{children}</div>
    </details>
  )
}

function Label({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  return (
    <label className={join('flex flex-col gap-1 text-[12.5px] text-muted', className)}>
      {text}
      {children}
    </label>
  )
}

/** The small controls on each repeated item: move up, move down, remove. */
function ItemTools({
  index,
  count,
  move,
  remove,
}: {
  index: number
  count: number
  move: (from: number, to: number) => void
  remove: (index: number) => void
}) {
  const t = useT().resume.editor
  const tool = 'rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-text disabled:opacity-30'
  return (
    <div className="flex gap-0.5">
      <button
        type="button"
        className={tool}
        disabled={index === 0}
        onClick={() => move(index, index - 1)}
        aria-label={t.moveUp}
      >
        <ArrowUp size={15} />
      </button>
      <button
        type="button"
        className={tool}
        disabled={index === count - 1}
        onClick={() => move(index, index + 1)}
        aria-label={t.moveDown}
      >
        <ArrowDown size={15} />
      </button>
      <button type="button" className={`${tool} hover:text-danger`} onClick={() => remove(index)} aria-label={t.remove}>
        <Trash size={15} />
      </button>
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="small" icon={<Plus size={15} />} onClick={onClick} className="self-start">
      {label}
    </Button>
  )
}

/** List helpers for one array field of the draft. */
function useList<K extends 'experience' | 'education' | 'skills' | 'languages' | 'certifications' | 'projects'>(
  draft: Resume,
  set: (r: Resume) => void,
  key: K,
) {
  const list = draft[key] as Resume[K]
  type Item = Resume[K][number]
  return {
    list,
    update: (i: number, patch: Partial<Item>) =>
      set({ ...draft, [key]: list.map((x, j) => (j === i ? { ...x, ...patch } : x)) }),
    add: (item: Item) => set({ ...draft, [key]: [...list, item] }),
    remove: (i: number) => set({ ...draft, [key]: list.filter((_, j) => j !== i) }),
    move: (from: number, to: number) => {
      const next = [...list]
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it!)
      set({ ...draft, [key]: next })
    },
  }
}

export function ResumeEditor({
  file,
  resume,
  onClose,
  onSaved,
}: {
  file: string
  resume: Resume
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const e = t.resume.editor
  const [draft, setDraft] = useState<Resume>(() => structuredClone(resume))
  const [problems, setProblems] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const b = draft.basics
  const setBasics = (patch: Partial<Resume['basics']>) => setDraft({ ...draft, basics: { ...b, ...patch } })

  const experience = useList(draft, setDraft, 'experience')
  const education = useList(draft, setDraft, 'education')
  const skills = useList(draft, setDraft, 'skills')
  const languages = useList(draft, setDraft, 'languages')
  const certifications = useList(draft, setDraft, 'certifications')
  const projects = useList(draft, setDraft, 'projects')
  const links = {
    update: (i: number, patch: Partial<Resume['basics']['links'][number]>) =>
      setBasics({ links: b.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) }),
    remove: (i: number) => setBasics({ links: b.links.filter((_, j) => j !== i) }),
  }

  const preview = (() => {
    const parsed = resumeSchema.safeParse(clean(draft))
    return parsed.success ? parsed.data : draft
  })()

  async function save() {
    setError(null)
    const parsed = resumeSchema.safeParse(clean(draft))
    if (!parsed.success) {
      setProblems(parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(' › ')}: ${i.message}`))
      return
    }
    setProblems([])
    setBusy(true)
    try {
      await api.put('/api/resumes', { file, resume: parsed.data })
      onSaved()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    // a focused, full-screen workspace: the form needs room next to the page
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={e.title}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-text">{e.title}</p>
          <p className="text-[13px] text-muted">{e.note}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="small" onClick={onClose}>
            {e.cancel}
          </Button>
          <Button size="small" onClick={save} disabled={busy}>
            {busy ? t.general.saving : e.save}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {problems.length > 0 && (
          <div className="mb-4 rounded-tile border border-danger/40 bg-danger/5 p-3 text-sm" role="alert">
            <p className="font-medium text-danger">{e.fix}</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <ErrorLine message={error} />

        <div className="mx-auto grid max-w-[1500px] gap-6 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <Group title={e.basics} open>
              <Label text={e.name}>
                <Input value={b.name} onChange={(ev) => setBasics({ name: ev.target.value })} />
              </Label>
              <Label text={e.headline}>
                <Input value={b.headline} onChange={(ev) => setBasics({ headline: ev.target.value })} />
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label text={e.location}>
                  <Input value={b.location} onChange={(ev) => setBasics({ location: ev.target.value })} />
                </Label>
                <Label text={e.phone}>
                  <Input value={b.phone} onChange={(ev) => setBasics({ phone: ev.target.value })} />
                </Label>
              </div>
              <Label text={e.email}>
                <Input type="email" value={b.email ?? ''} onChange={(ev) => setBasics({ email: ev.target.value })} />
              </Label>
              <p className="text-[12.5px] text-muted">{e.links}</p>
              {b.links.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={l.label}
                    placeholder={e.linkLabel}
                    aria-label={e.linkLabel}
                    onChange={(ev) => links.update(i, { label: ev.target.value })}
                    className="w-40"
                  />
                  <Input
                    value={l.url}
                    placeholder={e.linkUrl}
                    aria-label={e.linkUrl}
                    onChange={(ev) => links.update(i, { url: ev.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => links.remove(i)}
                    className="rounded-lg p-1.5 text-faint hover:text-danger"
                    aria-label={e.remove}
                  >
                    <Trash size={15} />
                  </button>
                </div>
              ))}
              <AddButton label={e.addLink} onClick={() => setBasics({ links: [...b.links, { label: '', url: '' }] })} />
            </Group>

            <Group title={t.resume.summary} open>
              <TextArea
                value={draft.summary}
                onChange={(ev) => setDraft({ ...draft, summary: ev.target.value })}
                className="min-h-32"
                aria-label={t.resume.summary}
              />
            </Group>

            <Group title={t.resume.experience} open>
              {experience.list.map((x: Experience, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-tile border border-border bg-surface-2/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="pt-1 text-[13.5px] font-medium text-text">
                      {x.role || e.role} — {x.company || e.company}
                    </p>
                    <ItemTools
                      index={i}
                      count={experience.list.length}
                      move={experience.move}
                      remove={experience.remove}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Label text={e.role}>
                      <Input value={x.role} onChange={(ev) => experience.update(i, { role: ev.target.value })} />
                    </Label>
                    <Label text={e.company}>
                      <Input value={x.company} onChange={(ev) => experience.update(i, { company: ev.target.value })} />
                    </Label>
                    <Label text={e.location}>
                      <Input
                        value={x.location}
                        onChange={(ev) => experience.update(i, { location: ev.target.value })}
                      />
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Label text={e.start}>
                        <Input
                          type="month"
                          value={x.start ?? ''}
                          onChange={(ev) => experience.update(i, { start: ev.target.value })}
                        />
                      </Label>
                      <Label text={e.end}>
                        <Input
                          type="month"
                          value={x.end ?? ''}
                          disabled={x.current}
                          onChange={(ev) => experience.update(i, { end: ev.target.value })}
                        />
                      </Label>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-text">
                    <input
                      type="checkbox"
                      checked={x.current}
                      onChange={(ev) => experience.update(i, { current: ev.target.checked })}
                      className="accent-[var(--accent)]"
                    />
                    {e.current}
                  </label>
                  <Label text={e.bullets}>
                    <TextArea
                      value={x.bullets.join('\n')}
                      onChange={(ev) => experience.update(i, { bullets: ev.target.value.split('\n') })}
                      className="min-h-28"
                    />
                  </Label>
                </div>
              ))}
              <AddButton
                label={e.addExperience}
                onClick={() => experience.add({ company: '', role: '', location: '', current: false, bullets: [] })}
              />
            </Group>

            <Group title={t.resume.education}>
              {education.list.map((x: Education, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-tile border border-border bg-surface-2/50 p-3">
                  <div className="flex justify-end">
                    <ItemTools
                      index={i}
                      count={education.list.length}
                      move={education.move}
                      remove={education.remove}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Label text={e.degree}>
                      <Input value={x.degree} onChange={(ev) => education.update(i, { degree: ev.target.value })} />
                    </Label>
                    <Label text={e.institution}>
                      <Input
                        value={x.institution}
                        onChange={(ev) => education.update(i, { institution: ev.target.value })}
                      />
                    </Label>
                    <Label text={e.start}>
                      <Input
                        type="month"
                        value={x.start ?? ''}
                        onChange={(ev) => education.update(i, { start: ev.target.value })}
                      />
                    </Label>
                    <Label text={e.end}>
                      <Input
                        type="month"
                        value={x.end ?? ''}
                        onChange={(ev) => education.update(i, { end: ev.target.value })}
                      />
                    </Label>
                  </div>
                  <Label text={e.notes}>
                    <Input value={x.notes} onChange={(ev) => education.update(i, { notes: ev.target.value })} />
                  </Label>
                </div>
              ))}
              <AddButton
                label={e.addEducation}
                onClick={() => education.add({ institution: '', degree: '', notes: '' })}
              />
            </Group>

            <Group title={t.resume.skills}>
              {skills.list.map((x, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-[0.6fr_1fr]">
                    <Input
                      value={x.group}
                      placeholder={e.group}
                      aria-label={e.group}
                      onChange={(ev) => skills.update(i, { group: ev.target.value })}
                    />
                    <Input
                      value={x.items.join(', ')}
                      placeholder={e.items}
                      aria-label={e.items}
                      onChange={(ev) => skills.update(i, { items: ev.target.value.split(',') })}
                    />
                  </div>
                  <ItemTools index={i} count={skills.list.length} move={skills.move} remove={skills.remove} />
                </div>
              ))}
              <AddButton label={e.addSkill} onClick={() => skills.add({ group: '', items: [] })} />
            </Group>

            <Group title={t.resume.languages}>
              {languages.list.map((x, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={x.language}
                    placeholder={e.language}
                    aria-label={e.language}
                    onChange={(ev) => languages.update(i, { language: ev.target.value })}
                  />
                  <Input
                    value={x.level}
                    placeholder={e.level}
                    aria-label={e.level}
                    onChange={(ev) => languages.update(i, { level: ev.target.value })}
                  />
                  <ItemTools index={i} count={languages.list.length} move={languages.move} remove={languages.remove} />
                </div>
              ))}
              <AddButton label={e.addLanguage} onClick={() => languages.add({ language: '', level: '' })} />
            </Group>

            <Group title={t.resume.certifications}>
              {certifications.list.map((x, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={x.name}
                    placeholder={e.certification}
                    aria-label={e.certification}
                    onChange={(ev) => certifications.update(i, { name: ev.target.value })}
                  />
                  <Input
                    value={x.issuer}
                    placeholder={e.issuer}
                    aria-label={e.issuer}
                    onChange={(ev) => certifications.update(i, { issuer: ev.target.value })}
                    className="w-36"
                  />
                  <Input
                    value={x.year}
                    placeholder={e.year}
                    aria-label={e.year}
                    onChange={(ev) => certifications.update(i, { year: ev.target.value })}
                    className="w-20"
                  />
                  <ItemTools
                    index={i}
                    count={certifications.list.length}
                    move={certifications.move}
                    remove={certifications.remove}
                  />
                </div>
              ))}
              <AddButton
                label={e.addCertification}
                onClick={() => certifications.add({ name: '', issuer: '', year: '' })}
              />
            </Group>

            <Group title={t.resume.projects}>
              {projects.list.map((x, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-tile border border-border bg-surface-2/50 p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={x.name}
                      placeholder={e.project}
                      aria-label={e.project}
                      onChange={(ev) => projects.update(i, { name: ev.target.value })}
                    />
                    <ItemTools index={i} count={projects.list.length} move={projects.move} remove={projects.remove} />
                  </div>
                  <TextArea
                    value={x.description}
                    placeholder={e.description}
                    aria-label={e.description}
                    onChange={(ev) => projects.update(i, { description: ev.target.value })}
                    className="min-h-20"
                  />
                  <Input
                    value={x.url ?? ''}
                    placeholder={e.url}
                    aria-label={e.url}
                    onChange={(ev) => projects.update(i, { url: ev.target.value })}
                  />
                </div>
              ))}
              <AddButton label={e.addProject} onClick={() => projects.add({ name: '', description: '' })} />
            </Group>
          </div>

          <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
            <div className="print-area flex justify-center">
              <ResumeView resume={preview} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
