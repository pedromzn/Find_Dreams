/**
 * The résumé studio's pieces, shared by the Résumés screen and the application's Résumé tab: the toolbar (template,
 * PDF, copy as text), the list of what tailoring changed, and the ATS check.
 */

import { useState } from 'react'
import { CheckCircle, Copy, Check, Printer, XCircle, Circle } from '@phosphor-icons/react'
import type { AtsReport } from '@shared/ats'
import { RESUME_TEMPLATES, resumeText, type Resume, type ResumeTemplate } from '@shared/resume'
import { Button, Loading, ScoreRing, Section, Segmented, join } from '@/components/ui'
import { useT } from '@/i18n'
import { api, useData } from '@/lib/api'
import { useLiveReload } from '@/lib/events'

export function ResumeToolbar({ file, resume, onChanged }: { file: string; resume: Resume; onChanged: () => void }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  async function setTemplate(template: ResumeTemplate) {
    await api.put('/api/resumes/template', { file, template })
    onChanged()
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(resumeText(resume))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* no clipboard permission */
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label={t.resume.template}
        value={resume.template}
        onChange={(v) => void setTemplate(v)}
        options={RESUME_TEMPLATES.map((id) => ({ id, label: t.resume.templates[id] }))}
      />
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="subtle" size="small" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copy}>
          {copied ? t.general.copied : t.resume.copyText}
        </Button>
        <Button
          variant="subtle"
          size="small"
          icon={<Printer size={16} />}
          onClick={() => window.print()}
          title={t.resume.printNote}
        >
          {t.resume.print}
        </Button>
      </div>
    </div>
  )
}

export function TailoringChanges({ resume }: { resume: Resume }) {
  const t = useT()
  if (!resume.tailoring?.changes.length) return null
  return (
    <Section title={t.resume.changes}>
      <ul className="flex flex-col gap-2 text-sm text-muted">
        {resume.tailoring.changes.map((c) => (
          <li key={c} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            {c}
          </li>
        ))}
      </ul>
    </Section>
  )
}

interface AtsResponse {
  basis: 'resume' | 'cv' | 'none'
  report: AtsReport | null
}

export function AtsPanel({ slug, className }: { slug: string; className?: string }) {
  const t = useT()
  const data = useData<AtsResponse>(`/api/applications/${slug}/ats`)
  useLiveReload(data.reload, slug)
  const body = (() => {
    if (data.error)
      return <p className="text-sm text-faint">{data.error.status === 409 ? t.ats.noJob : data.error.message}</p>
    if (!data.data) return <Loading className="py-6" />
    const { basis, report } = data.data
    if (!report) return <p className="text-sm text-faint">{t.ats.noCv}</p>
    const found = report.keywords.filter((k) => k.found)
    const missing = report.keywords.filter((k) => !k.found)
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <ScoreRing value={report.score} size={76} stroke={7} label={t.ats.title} />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-text">{t.ats.level(report.score)}</p>
            <p className="text-[13px] text-faint">{basis === 'resume' ? t.ats.basisResume : t.ats.basisCv}</p>
          </div>
        </div>
        {missing.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-text">
              {t.ats.missing} · {missing.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((k) => (
                <span
                  key={k.term}
                  className={join(
                    'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[12.5px]',
                    k.weight === 'required' ? 'border-danger/40 bg-danger/8 text-danger' : 'border-border text-muted',
                  )}
                  title={k.weight === 'required' ? t.ats.required : k.weight === 'nice' ? t.ats.nice : undefined}
                >
                  <XCircle size={13} weight="fill" aria-hidden />
                  {k.term}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-faint">{t.ats.missingNote}</p>
          </div>
        )}
        {found.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-text">
              {t.ats.found} · {found.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {found.map((k) => (
                <span
                  key={k.term}
                  className="inline-flex items-center gap-1 rounded-pill border border-success/35 bg-success/8 px-2.5 py-0.5 text-[12.5px] text-success"
                >
                  <CheckCircle size={13} weight="fill" aria-hidden />
                  {k.term}
                </span>
              ))}
            </div>
          </div>
        )}
        <ul className="flex flex-col gap-1.5 border-t border-border pt-4 text-[13.5px]">
          {report.checks.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              {c.ok ? (
                <CheckCircle size={17} weight="fill" className="text-success" aria-hidden />
              ) : (
                <Circle size={17} className="text-faint" aria-hidden />
              )}
              <span className={c.ok ? 'text-text' : 'text-muted'}>{t.ats.checks[c.id]}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  })()
  return (
    <Section title={t.ats.title} note={t.ats.note} className={className}>
      {body}
    </Section>
  )
}
