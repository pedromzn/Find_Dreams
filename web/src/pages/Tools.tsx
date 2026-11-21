/**
 * Tools: everything the AI can prepare for one application, in one place — tailored résumé, cover letter, follow-up,
 * salary research, likely questions, company research, fit and the ATS check. The results that have no screen of their
 * own (follow-ups, salary) show right below.
 */

import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Buildings,
  ChatsCircle,
  CheckCircle,
  CurrencyCircleDollar,
  EnvelopeSimple,
  FileText,
  PaperPlaneTilt,
  Scan,
  Target,
  Toolbox,
  type Icon,
} from '@phosphor-icons/react'
import type { ApplicationDetail, OverviewApplication } from '@shared/api'
import { readFrontMatter } from '@shared/workspace'
import { Empty, Header, LinkButton, Loading, Panel, Problems, ScreenError, Section, Select } from '@/components/ui'
import { AppPicker, useSelectedApp } from '@/components/AppPicker'
import { Markdown } from '@/components/Markdown'
import { format, useT } from '@/i18n'
import { useData } from '@/lib/api'
import { useLiveReload } from '@/lib/events'
import { useOverview } from '@/lib/overview'
import { AiButton } from '@/agent/AgentActions'

function Tool({
  icon: I,
  title,
  note,
  done,
  children,
}: {
  icon: Icon
  title: string
  note: string
  done?: boolean
  children: ReactNode
}) {
  return (
    <Panel className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile bg-surface-3 text-accent-text">
          <I size={20} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium text-text">
            {title}
            {done && <CheckCircle size={16} weight="fill" className="text-success" />}
          </p>
          <p className="text-[13px] leading-snug text-faint">{note}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">{children}</div>
    </Panel>
  )
}

function ResultLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[13.5px] no-underline hover:underline">
      {label}
      <ArrowRight size={14} />
    </Link>
  )
}

type When = 'applied' | 'interview' | 'silence' | 'rejected'

function ToolsFor({ app }: { app: OverviewApplication }) {
  const t = useT()
  const detail = useData<ApplicationDetail>(`/api/applications/${app.slug}`)
  useLiveReload(detail.reload, app.slug)
  const [when, setWhen] = useState<When>('applied')
  if (detail.error) return <ScreenError error={detail.error} onRetry={detail.reload} />
  if (!detail.data) return <Loading />
  const d = detail.data
  const i = t.tools.items
  const salaryFront = d.salary ? readFrontMatter(d.salary.content) : null
  const slug = app.slug

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <Tool icon={FileText} title={i.resume.title} note={i.resume.note} done={app.hasResume}>
          <AiButton task="tailor-resume" application={slug} size="small" label={t.tools.run} onDone={detail.reload} />
          {app.hasResume && <ResultLink to={`/resumes?show=app:${slug}`} label={t.tools.open} />}
        </Tool>
        <Tool icon={EnvelopeSimple} title={i.letter.title} note={i.letter.note} done={app.hasLetter}>
          <LinkButton to={`/letters?app=${slug}`} size="small" variant="subtle">
            {app.hasLetter ? t.tools.open : t.letters.write}
          </LinkButton>
        </Tool>
        <Tool icon={PaperPlaneTilt} title={i.followUp.title} note={i.followUp.note} done={d.followUps.length > 0}>
          <Select
            value={when}
            onChange={(e) => setWhen(e.target.value as When)}
            aria-label={t.tools.when}
            className="h-9 w-full py-0 text-[13.5px]"
          >
            {(Object.keys(t.tools.whenOptions) as When[]).map((w) => (
              <option key={w} value={w}>
                {t.tools.whenOptions[w]}
              </option>
            ))}
          </Select>
          <AiButton
            task="follow-up"
            application={slug}
            details={t.tools.whenOptions[when]}
            size="small"
            label={t.tools.run}
            onDone={detail.reload}
          />
        </Tool>
        <Tool icon={CurrencyCircleDollar} title={i.salary.title} note={i.salary.note} done={d.salary !== null}>
          <AiButton task="salary-research" application={slug} size="small" label={t.tools.run} onDone={detail.reload} />
        </Tool>
        <Tool icon={ChatsCircle} title={i.questions.title} note={i.questions.note} done={d.personas.length > 0}>
          <LinkButton to={`/applications/${slug}/practice`} size="small" variant="subtle">
            {t.interviewsHub.practice}
          </LinkButton>
        </Tool>
        <Tool icon={Buildings} title={i.company.title} note={i.company.note} done={d.company !== null}>
          <AiButton
            task="research-company"
            application={slug}
            size="small"
            label={t.tools.run}
            onDone={detail.reload}
          />
          {d.company && <ResultLink to={`/applications/${slug}`} label={t.tools.open} />}
        </Tool>
        <Tool icon={Target} title={i.fit.title} note={i.fit.note} done={d.fit !== null}>
          <AiButton task="analyze-fit" application={slug} size="small" label={t.tools.run} onDone={detail.reload} />
          {d.fit && <ResultLink to={`/applications/${slug}`} label={`${t.application.fitScore} ${d.fit.score}`} />}
        </Tool>
        <Tool icon={Scan} title={i.ats.title} note={i.ats.note} done={app.ats !== null}>
          <LinkButton to={`/resumes?show=app:${slug}`} size="small" variant="subtle">
            {app.ats === null ? t.tools.open : `ATS ${app.ats}`}
          </LinkButton>
        </Tool>
      </div>

      {d.salary && (
        <Section
          title={t.tools.salary}
          action={
            salaryFront?.data.low || salaryFront?.data.high ? (
              <span className="rounded-pill border border-success/40 bg-success/8 px-3 py-1 text-sm font-medium text-success">
                {t.tools.range}: {[salaryFront.data.low, salaryFront.data.high].filter(Boolean).join(' – ')}
              </span>
            ) : undefined
          }
        >
          <Problems problems={d.salary.problems} file="salary.md" />
          <Markdown text={salaryFront?.body ?? d.salary.content} />
        </Section>
      )}

      {d.followUps.length > 0 && (
        <Section title={t.tools.followUps}>
          <div className="flex flex-col gap-6">
            {[...d.followUps].reverse().map((f) => (
              <div key={f.name}>
                <p className="mb-2 text-[13px] text-faint">{format.date(f.name.slice(0, 10))}</p>
                <Problems problems={f.problems} file={`follow-ups/${f.name}`} />
                <Markdown text={f.content} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

export default function Tools() {
  const t = useT()
  const overview = useOverview()
  const apps = overview.data?.applications ?? []
  const { selected, select } = useSelectedApp(apps)
  if (overview.error) return <ScreenError error={overview.error} onRetry={overview.reload} />
  if (!overview.data) return <Loading />
  return (
    <div className="flex flex-col gap-6">
      <Header title={t.tools.title} note={t.tools.note} />
      {apps.length === 0 ? (
        <Empty icon={<Toolbox size={26} />} title={t.tools.noApplications}>
          <LinkButton to="/applications/new" className="mt-4">
            {t.nav.newApplication}
          </LinkButton>
        </Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <AppPicker apps={apps} selected={selected?.slug ?? null} onSelect={select} title={t.tools.pick} />
          <div className="min-w-0">{selected && <ToolsFor key={selected.slug} app={selected} />}</div>
        </div>
      )}
    </div>
  )
}
