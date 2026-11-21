/**
 * Home: where the search stands today. The pipeline (the stage spectrum, the app's signature), the numbers that matter,
 * what is due, what is on the calendar, what is ready per application and what happened lately. A first-run checklist
 * takes over the top until the basics are in place.
 */

import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  ChatsCircle,
  CheckCircle,
  Circle,
  Compass,
  FileText,
  Plus,
  type Icon,
} from '@phosphor-icons/react'
import type { Overview, OverviewApplication } from '@shared/api'
import { CLOSED_STATUSES, type Status } from '@shared/application'
import { Loading, ScoreRing, ScreenError, Section, Stat, join } from '@/components/ui'
import { format, useLanguage, useT } from '@/i18n'
import { LANGUAGE_DATA } from '@shared/languages'
import { daysFromToday, useOverview } from '@/lib/overview'
import { stageColor, StatusBadge } from '@/application/labels'
import { useAgents } from '@/agent/useAgents'

const PIPELINE: Status[] = ['saved', 'applied', 'screening', 'interviewing', 'offer']

function Shortcut({ to, icon: Icon, title, note }: { to: string; icon: Icon; title: string; note: string }) {
  return (
    <Link
      to={to}
      className="card group flex items-center gap-3.5 rounded-panel px-4 py-3.5 no-underline transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile bg-accent/12 text-accent-text">
        <Icon size={20} weight="duotone" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-text">{title}</span>
        <span className="block truncate text-[13px] text-faint">{note}</span>
      </span>
      <ArrowUpRight size={16} className="text-faint transition-colors group-hover:text-text" />
    </Link>
  )
}

function Pipeline({ overview }: { overview: Overview }) {
  const t = useT()
  const counts = PIPELINE.map((s) => ({ status: s, n: overview.metrics.byStatus[s] }))
  const total = counts.reduce((sum, c) => sum + c.n, 0)
  return (
    <Section title={t.home.pipeline} bodyClassName="flex flex-col gap-5">
      <div className="flex h-3 overflow-hidden rounded-pill bg-surface-3" aria-hidden>
        {total > 0 &&
          counts
            .filter((c) => c.n > 0)
            .map((c) => (
              <span
                key={c.status}
                className="h-full border-r-2 border-surface last:border-r-0"
                style={{ width: `${(c.n / total) * 100}%`, background: stageColor(c.status) }}
              />
            ))}
      </div>
      {total === 0 && <p className="-mt-2 text-sm text-faint">{t.home.pipelineEmpty}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {counts.map((c) => (
          <Link
            key={c.status}
            to="/applications"
            className="flex items-center gap-3 rounded-tile border border-border bg-surface-2/60 px-3.5 py-3 no-underline transition-colors hover:border-border-strong"
          >
            <span className="h-8 w-1 rounded-full" style={{ background: stageColor(c.status) }} aria-hidden />
            <span>
              <span className="block text-xl leading-tight font-semibold text-text tabular-nums">{c.n}</span>
              <span className="block text-[13px] text-muted">{t.status[c.status]}</span>
            </span>
          </Link>
        ))}
      </div>
    </Section>
  )
}

function Setup({ overview }: { overview: Overview }) {
  const t = useT()
  const agents = useAgents()
  const selected = agents.data?.agents.find((a) => a.id === agents.data?.selected)
  const steps = [
    { done: overview.hasCv, label: t.home.setupCv, to: '/profile' },
    { done: overview.hasBaseResume, label: t.home.setupResume, to: '/resumes' },
    { done: Boolean(selected?.installed && !selected.needsSecret), label: t.home.setupAgent, to: '/agent' },
    { done: overview.applications.length > 0, label: t.home.setupFirst, to: '/applications/new' },
  ]
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null
  return (
    <Section title={t.home.setup} note={t.home.setupDone(done, steps.length)}>
      <div className="mb-4 h-1.5 overflow-hidden rounded-pill bg-surface-3">
        <div className="h-full rounded-pill bg-accent" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s) => (
          <li key={s.label}>
            <Link
              to={s.to}
              className={join(
                'flex h-full items-center gap-3 rounded-tile border px-3.5 py-3 text-sm no-underline transition-colors',
                s.done
                  ? 'border-border text-faint line-through'
                  : 'border-border-strong bg-surface-2 text-text hover:border-accent/60',
              )}
            >
              {s.done ? (
                <CheckCircle size={20} weight="fill" className="shrink-0 text-success" />
              ) : (
                <Circle size={20} className="shrink-0 text-faint" />
              )}
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function NextSteps({ apps }: { apps: OverviewApplication[] }) {
  const t = useT()
  const steps = apps
    .filter((a) => !CLOSED_STATUSES.includes(a.status))
    .flatMap((a) => a.nextSteps.filter((s) => !s.done).map((s) => ({ ...s, app: a })))
    .sort((x, y) => (x.due ?? '9999').localeCompare(y.due ?? '9999'))
    .slice(0, 7)
  const when = (due: string | null) => {
    if (!due) return null
    const d = daysFromToday(due)
    if (d < 0) return <span className="font-medium text-danger">{t.home.overdue}</span>
    if (d === 0) return <span className="font-medium text-warning">{t.home.today}</span>
    return <span className="text-faint">{t.home.inDays(d)}</span>
  }
  return (
    <Section title={t.home.nextSteps} className="lg:col-span-7" bodyClassName="p-0">
      {steps.length === 0 ? (
        <p className="p-5 text-sm text-faint">{t.home.noSteps}</p>
      ) : (
        <ul className="divide-y divide-border">
          {steps.map((s, i) => (
            <li key={`${s.app.slug}-${i}`}>
              <Link
                to={`/applications/${s.app.slug}`}
                className="flex items-center gap-3 px-5 py-3 no-underline transition-colors hover:bg-surface-2/60"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stageColor(s.app.status) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-text">{s.what}</span>
                  <span className="block truncate text-[13px] text-faint">
                    {s.app.company} — {s.app.role}
                  </span>
                </span>
                <span className="shrink-0 text-[13px]">
                  {s.due && <span className="mr-2 text-faint">{format.shortDate(s.due)}</span>}
                  {when(s.due)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function Upcoming({ apps }: { apps: OverviewApplication[] }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const items = apps
    .flatMap((a) =>
      a.stages
        .filter((s) => s.date && s.result === 'scheduled' && daysFromToday(s.date) >= 0)
        .map((s) => ({ ...s, date: s.date!, app: a })),
    )
    .sort((x, y) => x.date.localeCompare(y.date))
    .slice(0, 5)
  return (
    <Section title={t.home.upcoming} className="lg:col-span-5" bodyClassName="p-0">
      {items.length === 0 ? (
        <p className="p-5 text-sm text-faint">{t.home.noUpcoming}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((s, i) => {
            const d = new Date(`${s.date}T12:00:00`)
            return (
              <li key={`${s.app.slug}-${i}`} className="flex items-center gap-3.5 px-5 py-3">
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-tile border border-border bg-surface-2 leading-none">
                  <span className="text-[16px] font-semibold text-text">{d.getDate()}</span>
                  <span className="mt-0.5 text-[10.5px] text-faint">
                    {d.toLocaleDateString(LANGUAGE_DATA[language].bcp47, { month: 'short' }).replace('.', '')}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-text">{t.interviewType[s.type]}</span>
                  <span className="block truncate text-[13px] text-faint">{s.app.company}</span>
                </span>
                <Link
                  to={`/applications/${s.app.slug}/practice`}
                  className="shrink-0 rounded-tile border border-border px-2.5 py-1 text-[13px] text-text no-underline hover:border-border-strong"
                >
                  {t.home.practice}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <CheckCircle size={18} weight="fill" className="text-success" aria-label={label} />
  ) : (
    <Circle size={18} className="text-border-strong" aria-label={label} />
  )
}

function Materials({ apps }: { apps: OverviewApplication[] }) {
  const t = useT()
  const active = apps.filter((a) => !CLOSED_STATUSES.includes(a.status)).slice(0, 8)
  const k = t.application.kitItems
  return (
    <Section title={t.home.materials} note={t.home.materialsNote} className="lg:col-span-8" bodyClassName="p-0">
      {active.length === 0 ? (
        <p className="p-5 text-sm text-faint">{t.home.noActive}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[12.5px] text-faint">
              <tr className="border-b border-border">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  {t.board.columns.company}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {t.board.columns.status}
                </th>
                <th scope="col" className="px-3 py-2.5 text-center font-medium">
                  {t.application.fitScore}
                </th>
                <th scope="col" className="px-3 py-2.5 text-center font-medium">
                  ATS
                </th>
                <th scope="col" className="px-3 py-2.5 text-center font-medium">
                  {t.application.tabs.resume}
                </th>
                <th scope="col" className="px-3 py-2.5 text-center font-medium">
                  {t.application.tabs.letter}
                </th>
                <th scope="col" className="px-5 py-2.5 text-center font-medium">
                  {t.tools.salary}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {active.map((a) => (
                <tr key={a.slug} className="transition-colors hover:bg-surface-2/60">
                  <td className="px-5 py-2.5">
                    <Link to={`/applications/${a.slug}`} className="block no-underline">
                      <span className="block font-medium text-text">{a.company}</span>
                      <span className="block max-w-[28ch] truncate text-[13px] text-faint">{a.role}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <ScoreRing value={a.fit} size={34} stroke={3.5} label={t.application.fitScore} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <ScoreRing value={a.ats} size={34} stroke={3.5} label="ATS" />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <Check ok={a.hasResume} label={k.resume} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <Check ok={a.hasLetter} label={k.letter} />
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-center">
                      <Check ok={a.hasSalary} label={k.salary} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function Recent({ overview }: { overview: Overview }) {
  const t = useT()
  const label = (kind: string, value: string) => {
    if (kind === 'status') return t.status[value as Status] ?? value
    if (kind === 'stage' || kind === 'simulation' || kind === 'debrief')
      return t.interviewType[value as keyof typeof t.interviewType] ?? value
    return value
  }
  return (
    <Section title={t.home.recent} className="lg:col-span-4">
      {overview.recent.length === 0 ? (
        <p className="text-sm text-faint">{t.home.noRecent}</p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
          {overview.recent.slice(0, 7).map((e, i) => (
            <li key={`${e.slug}-${e.at}-${i}`} className="relative">
              <span className="absolute top-1.5 -left-[25px] h-2 w-2 rounded-full bg-border-strong ring-4 ring-surface" />
              <Link to={`/applications/${e.slug}`} className="block no-underline">
                <span className="block text-[13.5px] text-text">
                  {t.timeline[e.kind]}: <span className="text-muted">{label(e.kind, e.label)}</span>
                </span>
                <span className="block text-[12.5px] text-faint">
                  {e.company} · {format.shortDate(e.at)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

export default function Home() {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const overview = useOverview()
  if (overview.error) return <ScreenError error={overview.error} onRetry={overview.reload} />
  if (!overview.data) return <Loading />
  const o = overview.data
  const m = o.metrics
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-faint first-letter:uppercase">
            {new Date().toLocaleDateString(LANGUAGE_DATA[language].bcp47, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="mt-1 text-[clamp(1.7rem,2.8vw,2.3rem)]">
            {t.home.greeting(o.profileName, new Date().getHours())}
          </h1>
          <p className="mt-1 text-muted">{t.home.note}</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Shortcut to="/applications/new" icon={Plus} title={t.home.quickNew} note={t.home.quickNewNote} />
        <Shortcut to="/discover" icon={Compass} title={t.home.quickFind} note={t.home.quickFindNote} />
        <Shortcut to="/resumes" icon={FileText} title={t.home.quickResume} note={t.home.quickResumeNote} />
        <Shortcut to="/interviews" icon={ChatsCircle} title={t.home.quickPractice} note={t.home.quickPracticeNote} />
      </div>

      <Setup overview={o} />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Pipeline overview={o} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:col-span-4">
          <Stat label={t.metrics.total} value={format.number(m.total)} accent="var(--st-saved)" />
          <Stat label={t.metrics.active} value={format.number(m.active)} accent="var(--st-interviewing)" />
          <Stat
            label={t.metrics.responseRate}
            value={m.responseRate === null ? '—' : `${Math.round(m.responseRate * 100)}%`}
            note={m.responseRate === null ? t.metrics.notEnough : undefined}
            accent="var(--st-applied)"
          />
          <Stat
            label={t.metrics.daysToInterview}
            value={m.daysToFirstInterview === null ? '—' : t.metrics.days(Math.round(m.daysToFirstInterview))}
            note={m.daysToFirstInterview === null ? t.metrics.notEnough : undefined}
            accent="var(--st-screening)"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <NextSteps apps={o.applications} />
        <Upcoming apps={o.applications} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Materials apps={o.applications} />
        <Recent overview={o} />
      </div>
    </div>
  )
}
