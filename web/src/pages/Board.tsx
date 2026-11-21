/**
 * The board: every application as a kanban by status (or a list), with filters and the few numbers that matter (how
 * many are active, the response rate, the time to the first interview). Closed processes fold away.
 *
 * A file with problems never disappears: it shows as a red-edged card, so the person (or their AI) can fix it.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarBlank, Kanban, ListBullets, MagnifyingGlass, Plus, WarningCircle } from '@phosphor-icons/react'
import type { ApplicationSummary, Metrics, OverviewApplication } from '@shared/api'
import { CLOSED_STATUSES, SOURCES, STATUSES, type Status } from '@shared/application'
import { WORK_MODELS } from '@shared/common'
import {
  Badge,
  Button,
  Empty,
  Header,
  Input,
  LinkButton,
  Loading,
  Panel,
  ScoreRing,
  ScreenError,
  Segmented,
  Select,
  Stat,
  join,
} from '@/components/ui'
import { format, useT } from '@/i18n'
import { useData } from '@/lib/api'
import { useServerEvents } from '@/lib/events'
import { stageColor, StatusBadge } from '@/application/labels'
import { daysFromToday, useOverview } from '@/lib/overview'

type Indexed = Extract<ApplicationSummary, { company: string }>
const isIndexed = (a: ApplicationSummary): a is Indexed => a.company !== null

const ACTIVE_COLUMNS: Status[] = ['saved', 'applied', 'screening', 'interviewing', 'offer']
const VIEW_KEY = 'mzn-vagas:board-view'

function storedView(): 'kanban' | 'list' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'kanban'
  } catch {
    return 'kanban'
  }
}

function MetricsRow({ metrics }: { metrics: Metrics }) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label={t.metrics.total} value={format.number(metrics.total)} accent="var(--st-saved)" />
      <Stat label={t.metrics.active} value={format.number(metrics.active)} accent="var(--st-interviewing)" />
      <Stat
        label={t.metrics.responseRate}
        value={metrics.responseRate === null ? '—' : `${Math.round(metrics.responseRate * 100)}%`}
        note={metrics.responseRate === null ? t.metrics.notEnough : t.metrics.responseRateNote}
        accent="var(--st-applied)"
      />
      <Stat
        label={t.metrics.daysToInterview}
        value={metrics.daysToFirstInterview === null ? '—' : t.metrics.days(Math.round(metrics.daysToFirstInterview))}
        note={metrics.daysToFirstInterview === null ? t.metrics.notEnough : undefined}
        accent="var(--st-screening)"
      />
    </div>
  )
}

/** A steady color per company, from its name: the initial tile tells cards apart at a glance. */
function hue(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

export function CompanyTile({ name, size = 36 }: { name: string; size?: number }) {
  const h = hue(name)
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-tile font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        color: `hsl(${h} 70% 72%)`,
        background: `hsl(${h} 45% 50% / 0.16)`,
      }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || '·'}
    </span>
  )
}

function Card({ application, extra }: { application: ApplicationSummary; extra?: OverviewApplication }) {
  const t = useT()
  const broken = application.problems.length > 0
  const step = extra?.nextSteps.find((n) => !n.done)
  const late = step?.due ? daysFromToday(step.due) < 0 : false
  return (
    <Link
      to={`/applications/${application.slug}`}
      className={join(
        'card group relative block overflow-hidden rounded-tile p-3.5 pl-4 no-underline transition-colors hover:border-border-strong hover:bg-surface-2',
        broken && 'border-danger/50',
      )}
    >
      {isIndexed(application) && (
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: stageColor(application.status) }}
          aria-hidden
        />
      )}
      {isIndexed(application) ? (
        <>
          <div className="flex items-start gap-3">
            <CompanyTile name={application.company} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium text-text">{application.company}</p>
              <p className="line-clamp-2 text-[13px] leading-snug text-muted">{application.role}</p>
            </div>
            {extra && extra.fit !== null && (
              <ScoreRing value={extra.fit} size={32} stroke={3} label={t.application.fitScore} />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {application.workModel && <Badge>{t.workModel[application.workModel]}</Badge>}
            <Badge>{t.source[application.source]}</Badge>
          </div>
          {step && (
            <p
              className={join(
                'mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-[12.5px]',
                late ? 'text-danger' : 'text-faint',
              )}
            >
              <CalendarBlank size={14} aria-hidden className="shrink-0" />
              <span className="truncate">{step.what}</span>
              {step.due && <span className="ml-auto shrink-0">{format.shortDate(step.due)}</span>}
            </p>
          )}
        </>
      ) : (
        <p className="font-mono text-sm text-text">{application.slug}</p>
      )}
      {broken && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
          <WarningCircle size={14} weight="fill" aria-hidden />
          {t.board.invalid}
        </p>
      )}
    </Link>
  )
}

function KanbanView({
  items,
  showClosed,
  extras,
}: {
  items: ApplicationSummary[]
  showClosed: boolean
  extras: Map<string, OverviewApplication>
}) {
  const t = useT()
  const broken = items.filter((a) => !isIndexed(a))
  const columns = showClosed ? [...ACTIVE_COLUMNS, ...CLOSED_STATUSES] : ACTIVE_COLUMNS
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {broken.length > 0 && (
        <section className="flex w-72 shrink-0 flex-col gap-2">
          <h2 className="flex items-center gap-2 px-1 font-sans text-sm font-medium text-danger">
            <WarningCircle size={16} weight="fill" aria-hidden />
            {t.board.invalid} · {broken.length}
          </h2>
          {broken.map((a) => (
            <Card key={a.slug} application={a} />
          ))}
        </section>
      )}
      {columns.map((status) => {
        const cards = items.filter((a) => isIndexed(a) && a.status === status)
        return (
          <section
            key={status}
            className="flex min-w-[236px] flex-1 shrink-0 flex-col rounded-panel border border-border bg-surface/50"
            aria-label={t.status[status]}
          >
            <h2 className="flex items-center gap-2 px-3.5 pt-3 pb-2 font-sans text-[13.5px] font-semibold tracking-normal text-text">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: stageColor(status) }} aria-hidden />
              <span>{t.status[status]}</span>
              <span className="ml-auto rounded-pill bg-surface-3 px-2 text-xs font-medium text-muted tabular-nums">
                {cards.length}
              </span>
            </h2>
            <div className="flex min-h-40 flex-1 flex-col gap-2 p-2 pt-1">
              {cards.map((a) => (
                <Card key={a.slug} application={a} extra={extras.get(a.slug)} />
              ))}
              {cards.length === 0 && (
                <p className="flex flex-1 items-center justify-center rounded-tile border border-dashed border-border px-4 py-6 text-center text-[13px] text-faint">
                  {t.board.emptyColumn[status]}
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ListView({ items, extras }: { items: ApplicationSummary[]; extras: Map<string, OverviewApplication> }) {
  const t = useT()
  const c = t.board.columns
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-[13px] text-faint">
          <tr>
            {[c.company, c.role, c.status, t.application.fitScore, c.source, c.model, c.updated].map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.slug} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
              <td className="px-4 py-3">
                <Link
                  to={`/applications/${a.slug}`}
                  className="flex items-center gap-2.5 font-medium text-text no-underline hover:text-accent-text"
                >
                  {a.company && <CompanyTile name={a.company} size={28} />}
                  {a.company ?? a.slug}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">{a.role ?? '—'}</td>
              <td className="px-4 py-3">
                {isIndexed(a) ? <StatusBadge status={a.status} /> : <Badge tone="danger">{t.board.invalid}</Badge>}
              </td>
              <td className="px-4 py-3">
                <ScoreRing
                  value={extras.get(a.slug)?.fit ?? null}
                  size={30}
                  stroke={3}
                  label={t.application.fitScore}
                />
              </td>
              <td className="px-4 py-3 text-muted">{isIndexed(a) ? t.source[a.source] : '—'}</td>
              <td className="px-4 py-3 text-muted">{isIndexed(a) && a.workModel ? t.workModel[a.workModel] : '—'}</td>
              <td className="px-4 py-3 text-muted">{isIndexed(a) ? format.shortDate(a.updatedAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export default function Board() {
  const t = useT()
  const list = useData<ApplicationSummary[]>('/api/applications')
  const metrics = useData<Metrics>('/api/metrics')
  const overview = useOverview()
  const extras = useMemo(() => new Map((overview.data?.applications ?? []).map((a) => [a.slug, a])), [overview.data])
  useServerEvents((e) => {
    if (e.type === 'file' && e.kind === 'application') {
      void list.reload()
      void metrics.reload()
    }
  })
  const [view, setView] = useState(storedView)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status | ''>('')
  const [source, setSource] = useState('')
  const [model, setModel] = useState('')
  const [showClosed, setShowClosed] = useState(false)

  const changeView = (v: 'kanban' | 'list') => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private window */
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (list.data ?? []).filter((a) => {
      if (!isIndexed(a)) return !status && !source && !model && (!q || a.slug.includes(q))
      if (q && !`${a.company} ${a.role}`.toLowerCase().includes(q)) return false
      if (status && a.status !== status) return false
      if (source && a.source !== source) return false
      if (model && a.workModel !== model) return false
      if (view === 'list' && !showClosed && !status && CLOSED_STATUSES.includes(a.status)) return false
      return true
    })
  }, [list.data, query, status, source, model, view, showClosed])

  if (list.error) return <ScreenError error={list.error} onRetry={list.reload} />
  if (!list.data) return <Loading />

  const closedCount = list.data.filter((a) => isIndexed(a) && CLOSED_STATUSES.includes(a.status)).length

  return (
    <div className="flex flex-col gap-6">
      <Header
        title={t.board.title}
        note={t.board.note}
        actions={
          <LinkButton to="/applications/new" icon={<Plus size={18} weight="bold" />}>
            {t.nav.newApplication}
          </LinkButton>
        }
      />
      {metrics.data && metrics.data.total > 0 && <MetricsRow metrics={metrics.data} />}

      {list.data.length === 0 ? (
        <Empty icon={<Kanban size={28} />} title={t.board.empty}>
          <p>{t.board.emptyNote}</p>
          <LinkButton to="/applications/new" className="mt-4" icon={<Plus size={18} weight="bold" />}>
            {t.board.addFirst}
          </LinkButton>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <MagnifyingGlass
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.board.search}
                aria-label={t.board.search}
                className="pl-10"
              />
            </div>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status | '')}
              aria-label={t.board.allStatuses}
              className="w-auto"
            >
              <option value="">{t.board.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.status[s]}
                </option>
              ))}
            </Select>
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label={t.board.allSources}
              className="w-auto"
            >
              <option value="">{t.board.allSources}</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t.source[s]}
                </option>
              ))}
            </Select>
            <Select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label={t.board.allModels}
              className="w-auto"
            >
              <option value="">{t.board.allModels}</option>
              {WORK_MODELS.map((m) => (
                <option key={m} value={m}>
                  {t.workModel[m]}
                </option>
              ))}
            </Select>
            <Segmented
              label={t.board.kanban}
              value={view}
              onChange={changeView}
              options={[
                { id: 'kanban', label: t.board.kanban, icon: <Kanban size={16} aria-hidden /> },
                { id: 'list', label: t.board.list, icon: <ListBullets size={16} aria-hidden /> },
              ]}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted">{t.board.nothingFound}</p>
          ) : view === 'kanban' ? (
            <KanbanView
              items={filtered}
              extras={extras}
              showClosed={showClosed || CLOSED_STATUSES.includes(status as Status)}
            />
          ) : (
            <ListView items={filtered} extras={extras} />
          )}

          {closedCount > 0 && !status && (
            <div>
              <Button variant="ghost" size="small" onClick={() => setShowClosed((v) => !v)}>
                {showClosed ? t.board.hideClosed : `${t.board.showClosed} · ${t.board.closed(closedCount)}`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
