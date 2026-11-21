/**
 * A résumé on paper, in one of three templates. The section titles follow the résumé's own language (not the
 * interface's): a résumé in English keeps English headings even when the app is in Portuguese.
 *
 * - modern: a tinted side column (contact, skills, languages) and the story on the right.
 * - harvard: one serif column, centered name, ruled section titles — the classic US format.
 * - classic: one sans column, left-aligned, compact — the safest for tracking systems.
 */

import type { ReactNode } from 'react'
import type { Resume } from '@shared/resume'
import { DICTIONARIES } from '@/i18n'

function useHeadings(r: Resume) {
  return DICTIONARIES[r.language].resume
}

function period(r: Resume, start?: string, end?: string, current?: boolean): string {
  const h = DICTIONARIES[r.language].resume
  const fmt = (v?: string) => {
    if (!v) return ''
    if (!/^\d{4}-\d{2}$/.test(v)) return v
    const d = new Date(`${v}-15T12:00:00`)
    return d.toLocaleDateString(r.language === 'pt-BR' ? 'pt-BR' : 'en-US', { month: 'short', year: 'numeric' })
  }
  const a = fmt(start)
  const b = current ? h.present : fmt(end)
  return a && b ? `${a} – ${b}` : a || b
}

const contactLine = (r: Resume) =>
  [r.basics.location, r.basics.email, r.basics.phone, ...r.basics.links.map((l) => l.url.replace(/^https?:\/\//, ''))]
    .filter(Boolean)
    .join('  ·  ')

function Modern({ r }: { r: Resume }) {
  const h = useHeadings(r)
  const Side = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="mb-6">
      <h2 className="mb-2 text-[11.5px] font-semibold tracking-wide text-paper-accent">{title}</h2>
      {children}
    </section>
  )
  const Main = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="mb-6">
      <h2 className="mb-2.5 flex items-center gap-3 text-[13px] font-semibold text-paper-ink">
        {title}
        <span className="h-px flex-1 bg-paper-rule" />
      </h2>
      {children}
    </section>
  )
  return (
    <div className="grid min-h-[inherit] grid-cols-[34%_1fr]">
      <aside className="bg-paper-tint px-7 py-9">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{r.basics.name}</h1>
        {r.basics.headline && <p className="mt-1.5 text-[13.5px] text-paper-accent">{r.basics.headline}</p>}
        <div className="mt-6 flex flex-col gap-1 text-[12.5px] break-words text-paper-muted">
          {r.basics.location && <span>{r.basics.location}</span>}
          {r.basics.email && <span>{r.basics.email}</span>}
          {r.basics.phone && <span>{r.basics.phone}</span>}
          {r.basics.links.map((l) => (
            <a key={l.url} href={l.url}>
              {l.label}: {l.url.replace(/^https?:\/\//, '')}
            </a>
          ))}
        </div>
        <div className="mt-8">
          {r.skills.length > 0 && (
            <Side title={h.skills}>
              {r.skills.map((s) => (
                <div key={s.group} className="mb-2.5">
                  <p className="text-[12px] font-semibold">{s.group}</p>
                  <p className="text-[12.5px] text-paper-muted">{s.items.join(', ')}</p>
                </div>
              ))}
            </Side>
          )}
          {r.languages.length > 0 && (
            <Side title={h.languages}>
              {r.languages.map((l) => (
                <p key={l.language} className="text-[12.5px]">
                  {l.language} <span className="text-paper-muted">— {l.level}</span>
                </p>
              ))}
            </Side>
          )}
          {r.certifications.length > 0 && (
            <Side title={h.certifications}>
              {r.certifications.map((c) => (
                <p key={c.name} className="mb-1 text-[12.5px]">
                  {c.name}
                  {(c.issuer || c.year) && (
                    <span className="text-paper-muted"> — {[c.issuer, c.year].filter(Boolean).join(', ')}</span>
                  )}
                </p>
              ))}
            </Side>
          )}
        </div>
      </aside>
      <div className="px-8 py-9">
        {r.summary && (
          <Main title={h.summary}>
            <p className="text-paper-ink">{r.summary}</p>
          </Main>
        )}
        {r.experience.length > 0 && (
          <Main title={h.experience}>
            {r.experience.map((e, i) => (
              <article key={`${e.company}-${i}`} className="mb-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="text-[14px] font-semibold">{e.role}</h3>
                  <span className="text-[12px] text-paper-muted">{period(r, e.start, e.end, e.current)}</span>
                </div>
                <p className="text-[12.5px] text-paper-accent">
                  {e.company}
                  {e.location && <span className="text-paper-muted"> · {e.location}</span>}
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {e.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </article>
            ))}
          </Main>
        )}
        {r.projects.length > 0 && (
          <Main title={h.projects}>
            {r.projects.map((p) => (
              <p key={p.name} className="mb-1.5">
                <span className="font-semibold">{p.name}</span> — {p.description}
              </p>
            ))}
          </Main>
        )}
        {r.education.length > 0 && (
          <Main title={h.education}>
            {r.education.map((e, i) => (
              <div key={`${e.institution}-${i}`} className="mb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">{e.degree}</p>
                  <span className="text-[12px] text-paper-muted">{period(r, e.start, e.end)}</span>
                </div>
                <p className="text-[12.5px] text-paper-muted">{e.institution}</p>
                {e.notes && <p className="text-[12.5px]">{e.notes}</p>}
              </div>
            ))}
          </Main>
        )}
      </div>
    </div>
  )
}

/** Harvard and Classic share the single-column structure; they differ in type, alignment and rules. */
function SingleColumn({ r, variant }: { r: Resume; variant: 'harvard' | 'classic' }) {
  const h = useHeadings(r)
  const harvard = variant === 'harvard'
  const Title = ({ children }: { children: ReactNode }) =>
    harvard ? (
      <h2 className="mt-5 mb-2 border-b border-paper-ink pb-0.5 text-[13.5px] font-bold [font-variant:small-caps] tracking-wide">
        {children}
      </h2>
    ) : (
      <h2 className="mt-5 mb-2 text-[13px] font-semibold text-paper-accent">{children}</h2>
    )
  return (
    <div className={harvard ? 'serif-doc px-12 py-10 text-[13px]' : 'px-11 py-10'}>
      <header className={harvard ? 'text-center' : 'border-b border-paper-rule pb-4'}>
        <h1 className={harvard ? 'text-[24px] font-bold tracking-wide' : 'text-[25px] font-semibold tracking-tight'}>
          {r.basics.name}
        </h1>
        {r.basics.headline && (
          <p className={harvard ? 'mt-0.5 italic' : 'mt-0.5 text-paper-muted'}>{r.basics.headline}</p>
        )}
        <p className="mt-1.5 text-[12px] text-paper-muted">{contactLine(r)}</p>
      </header>
      {r.summary && (
        <>
          <Title>{h.summary}</Title>
          <p>{r.summary}</p>
        </>
      )}
      {r.experience.length > 0 && (
        <>
          <Title>{h.experience}</Title>
          {r.experience.map((e, i) => (
            <article key={`${e.company}-${i}`} className="mb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p>
                  <span className="font-bold">{harvard ? e.company : e.role}</span>
                  {!harvard && <span className="text-paper-muted"> — {e.company}</span>}
                </p>
                <span className="text-[12px]">{harvard ? e.location : period(r, e.start, e.end, e.current)}</span>
              </div>
              {harvard && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="italic">{e.role}</p>
                  <span className="text-[12px] italic">{period(r, e.start, e.end, e.current)}</span>
                </div>
              )}
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {e.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </>
      )}
      {r.education.length > 0 && (
        <>
          <Title>{h.education}</Title>
          {r.education.map((e, i) => (
            <div key={`${e.institution}-${i}`} className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
              <p>
                <span className="font-bold">{e.institution}</span> — {e.degree}
                {e.notes && <span className="text-paper-muted"> ({e.notes})</span>}
              </p>
              <span className="text-[12px]">{period(r, e.start, e.end)}</span>
            </div>
          ))}
        </>
      )}
      {r.projects.length > 0 && (
        <>
          <Title>{h.projects}</Title>
          {r.projects.map((p) => (
            <p key={p.name} className="mb-1">
              <span className="font-bold">{p.name}</span> — {p.description}
            </p>
          ))}
        </>
      )}
      {(r.skills.length > 0 || r.languages.length > 0 || r.certifications.length > 0) && (
        <>
          <Title>{h.skills}</Title>
          <div className="space-y-0.5">
            {r.skills.map((s) => (
              <p key={s.group}>
                <span className="font-bold">{s.group}:</span> {s.items.join(', ')}
              </p>
            ))}
            {r.languages.length > 0 && (
              <p>
                <span className="font-bold">{h.languages}:</span>{' '}
                {r.languages.map((l) => `${l.language} (${l.level})`).join(', ')}
              </p>
            )}
            {r.certifications.length > 0 && (
              <p>
                <span className="font-bold">{h.certifications}:</span>{' '}
                {r.certifications.map((c) => [c.name, c.year].filter(Boolean).join(' ')).join('; ')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function ResumeView({ resume, className }: { resume: Resume; className?: string }) {
  return (
    <div className={`sheet overflow-hidden ${className ?? ''}`} lang={resume.language}>
      {resume.template === 'modern' ? <Modern r={resume} /> : <SingleColumn r={resume} variant={resume.template} />}
    </div>
  )
}
