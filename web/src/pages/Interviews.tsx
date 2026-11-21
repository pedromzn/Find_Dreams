/**
 * Interviews: every stage on the calendar, every practice session (with its score, so progress shows), and a way into
 * practice for each application in progress.
 */

import { Link } from 'react-router-dom'
import { ChatsCircle, Microphone, NotePencil } from '@phosphor-icons/react'
import { CLOSED_STATUSES } from '@shared/application'
import { Empty, Header, LinkButton, Loading, Panel, ScreenError, Section, Stat } from '@/components/ui'
import { format, useT } from '@/i18n'
import { daysFromToday, useOverview } from '@/lib/overview'
import { CompanyTile } from '@/pages/Board'
import { stageColor } from '@/application/labels'

export default function Interviews() {
  const t = useT()
  const overview = useOverview()
  if (overview.error) return <ScreenError error={overview.error} onRetry={overview.reload} />
  if (!overview.data) return <Loading />
  const apps = overview.data.applications
  const sessions = apps.flatMap((a) => a.practice.map((p) => ({ ...p, app: a }))).sort((x, y) => (x.id < y.id ? 1 : -1))
  const scored = sessions.filter((s) => s.score !== null)
  const average = scored.length ? scored.reduce((sum, s) => sum + s.score!, 0) / scored.length : null
  const scheduled = apps
    .flatMap((a) =>
      a.stages
        .filter((s) => s.date && s.result === 'scheduled' && daysFromToday(s.date) >= 0)
        .map((s) => ({ ...s, date: s.date!, app: a })),
    )
    .sort((x, y) => x.date.localeCompare(y.date))
  const active = apps.filter((a) => !CLOSED_STATUSES.includes(a.status))
  const trend = [...scored].reverse().slice(-12)

  return (
    <div className="flex flex-col gap-6">
      <Header title={t.interviewsHub.title} note={t.interviewsHub.note} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.interviewsHub.scheduled} value={scheduled.length} accent="var(--st-interviewing)" />
        <Stat label={t.interviewsHub.total} value={sessions.length} accent="var(--st-screening)" />
        <Stat
          label={t.interviewsHub.average}
          value={average === null ? '—' : `${average.toFixed(1)} / 5`}
          accent="var(--st-offer)"
        />
        <Stat
          label={t.interviewsHub.debriefs}
          value={apps.reduce((sum, a) => sum + a.debriefs, 0)}
          accent="var(--st-applied)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Section title={t.interviewsHub.scheduled} className="lg:col-span-5" bodyClassName="p-0">
          {scheduled.length === 0 ? (
            <p className="p-5 text-sm text-faint">{t.interviewsHub.noScheduled}</p>
          ) : (
            <ul className="divide-y divide-border">
              {scheduled.map((s, i) => (
                <li key={`${s.app.slug}-${i}`} className="flex items-center gap-3 px-5 py-3">
                  <CompanyTile name={s.app.company} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] text-text">{t.interviewType[s.type]}</span>
                    <span className="block truncate text-[13px] text-faint">
                      {s.app.company} · {format.date(s.date)}
                    </span>
                  </span>
                  <LinkButton to={`/applications/${s.app.slug}/practice`} size="small" variant="subtle">
                    {t.interviewsHub.practice}
                  </LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t.interviewsHub.sessions} className="lg:col-span-7" bodyClassName="p-0">
          {sessions.length === 0 ? (
            <p className="p-5 text-sm text-faint">{t.interviewsHub.noSessions}</p>
          ) : (
            <>
              {trend.length > 1 && (
                <div className="flex h-20 items-end gap-1.5 border-b border-border px-5 pt-4 pb-3" aria-hidden>
                  {trend.map((s) => (
                    <span
                      key={s.id + s.app.slug}
                      className="flex-1 rounded-t-[4px] bg-st-screening/70"
                      style={{ height: `${(s.score! / 5) * 100}%` }}
                      title={`${s.score!.toFixed(1)} / 5`}
                    />
                  ))}
                </div>
              )}
              <ul className="divide-y divide-border">
                {sessions.slice(0, 8).map((s) => (
                  <li key={s.app.slug + s.id}>
                    <Link
                      to={`/applications/${s.app.slug}/interviews/${s.id}`}
                      className="flex items-center gap-3 px-5 py-3 no-underline transition-colors hover:bg-surface-2/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-st-screening/15 text-st-screening">
                        <ChatsCircle size={18} weight="duotone" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] text-text">{t.interviewType[s.type]}</span>
                        <span className="block truncate text-[13px] text-faint">
                          {s.app.company} · {format.shortDate(s.date)}
                        </span>
                      </span>
                      {s.score !== null && (
                        <span className="flex w-28 shrink-0 items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-3">
                            <span
                              className="block h-full rounded-pill bg-st-offer"
                              style={{ width: `${(s.score / 5) * 100}%` }}
                            />
                          </span>
                          <span className="text-[13px] font-medium text-text tabular-nums">{s.score.toFixed(1)}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[15px] font-semibold text-text">{t.interviewsHub.byApplication}</h2>
        {active.length === 0 ? (
          <Empty icon={<Microphone size={26} />} title={t.interviewsHub.noApplications}>
            <LinkButton to="/applications/new" className="mt-4">
              {t.nav.newApplication}
            </LinkButton>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((a) => {
              const last = a.practice.at(-1)
              return (
                <Panel key={a.slug} className="relative flex flex-col gap-4 overflow-hidden p-4">
                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: stageColor(a.status) }} />
                  <div className="flex items-center gap-3">
                    <CompanyTile name={a.company} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/applications/${a.slug}`}
                        className="block truncate font-medium text-text no-underline"
                      >
                        {a.company}
                      </Link>
                      <p className="truncate text-[13px] text-faint">{a.role}</p>
                    </div>
                    <span className="text-right text-[12.5px] text-faint">
                      {a.practice.length} ×
                      {last?.score != null && <span className="block text-text">{last.score.toFixed(1)} / 5</span>}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <LinkButton to={`/applications/${a.slug}/practice`} size="small" icon={<Microphone size={16} />}>
                      {t.interviewsHub.practice}
                    </LinkButton>
                    <LinkButton
                      to={`/applications/${a.slug}/debrief`}
                      size="small"
                      variant="subtle"
                      icon={<NotePencil size={16} />}
                    >
                      {t.interviewsHub.debrief}
                    </LinkButton>
                  </div>
                </Panel>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
