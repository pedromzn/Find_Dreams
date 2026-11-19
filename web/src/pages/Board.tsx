/**
 * The board: every application as a kanban by status (or a list), with filters and the few numbers that matter (how
 * many are active, the response rate, the time to the first interview). Closed processes fold away.
 *
 * A file with problems never disappears: it shows as a red-edged card, so the person (or their AI) can fix it.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Kanban, ListBullets, MagnifyingGlass, Plus, WarningCircle } from '@phosphor-icons/react'
import type { ApplicationSummary, Metrics } from '@shared/api'
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
  ScreenError,
  Select,
  join,
} from '@/components/ui'
import { format, useT } from '@/i18n'
import { useData } from '@/lib/api'
import { StatusBadge } from '@/application/labels'

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

function MetricTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Panel className="flex flex-col gap-1 px-5 py-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-display text-3xl text-text">{value}</span>
      {note && <span className="text-xs text-faint">{note}</span>}
    </Panel>
  )
}

function MetricsRow({ metrics }: { metrics: Metrics }) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricTile label={t.metrics.total} value={format.number(metrics.total)} />
      <MetricTile label={t.metrics.active} value={format.number(metrics.active)} />
      <MetricTile
        label={t.metrics.responseRate}
        value={metrics.responseRate === null ? '—' : `${Math.round(metrics.responseRate * 100)}%`}
        note={metrics.responseRate === null ? t.metrics.notEnough : t.metrics.responseRateNote}
      />
      <MetricTile
        label={t.metrics.daysToInterview}
        value={metrics.daysToFirstInterview === null ? '—' : t.metrics.days(Math.round(metrics.daysToFirstInterview))}
        note={metrics.daysToFirstInterview === null ? t.metrics.notEnough : undefined}
      />
    </div>
  )
}

function Card({ application }: { application: ApplicationSummary }) {
  const t = useT()
  const broken = application.problems.length > 0
  return (
    <Link
      to={`/applications/${application.slug}`}
      className={join(
        'card block rounded-tile p-4 transition-colors hover:border-border-strong',
        broken && 'border-danger/50',
      )}
    >
      {isIndexed(application) ? (
        <>
          <p className="font-medium text-text">{application.company}</p>
          <p className="mt-0.5 text-sm text-muted">{application.role}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {application.workModel && <Badge>{t.workModel[application.workModel]}</Badge>}
            <Badge>{t.source[application.source]}</Badge>
          </div>
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

function KanbanView({ items, showClosed }: { items: ApplicationSummary[]; showClosed: boolean }) {
  const t = useT()
  const broken = items.filter((a) => !isIndexed(a))
  const columns = showClosed ? [...ACTIVE_COLUMNS, ...CLOSED_STATUSES] : ACTIVE_COLUMNS
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {broken.length > 0 && (
        <section className="flex w-64 shrink-0 flex-col gap-2">
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
          <section key={status} className="flex w-64 shrink-0 flex-col gap-2" aria-label={t.status[status]}>
            <h2 className="flex items-center justify-between px-1 font-sans text-sm font-medium text-muted">
              <span>{t.status[status]}</span>
              <span className="text-faint">{cards.length}</span>
            </h2>
            <div className="flex min-h-24 flex-col gap-2 rounded-panel bg-surface/50 p-2">
              {cards.map((a) => (
                <Card key={a.slug} application={a} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ListView({ items }: { items: ApplicationSummary[] }) {
  const t = useT()
  const c = t.board.columns
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-muted">
          <tr>
            {[c.company, c.role, c.status, c.source, c.model, c.updated].map((h) => (
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
                <Link to={`/applications/${a.slug}`} className="text-text hover:text-accent-text">
                  {a.company ?? a.slug}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">{a.role ?? '—'}</td>
              <td className="px-4 py-3">
                {isIndexed(a) ? <StatusBadge status={a.status} /> : <Badge tone="danger">{t.board.invalid}</Badge>}
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
    <div className="flex flex-col gap-8">
      <Header
        title={t.board.title}
        note={t.board.note}
        actions={
          <LinkButton to="/new" icon={<Plus size={18} weight="bold" />}>
            {t.nav.newApplication}
          </LinkButton>
        }
      />
      {metrics.data && metrics.data.total > 0 && <MetricsRow metrics={metrics.data} />}

      {list.data.length === 0 ? (
        <Empty icon={<Kanban size={36} />} title={t.board.empty}>
          <p>{t.board.emptyNote}</p>
          <LinkButton to="/new" className="mt-4" icon={<Plus size={18} weight="bold" />}>
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
            <div className="flex rounded-pill border border-border p-1" role="group">
              {(['kanban', 'list'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => changeView(v)}
                  className={join(
                    'flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm',
                    view === v ? 'bg-surface-2 text-text' : 'text-muted hover:text-text',
                  )}
                >
                  {v === 'kanban' ? <Kanban size={16} aria-hidden /> : <ListBullets size={16} aria-hidden />}
                  {v === 'kanban' ? t.board.kanban : t.board.list}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted">{t.board.nothingFound}</p>
          ) : view === 'kanban' ? (
            <KanbanView items={filtered} showClosed={showClosed || CLOSED_STATUSES.includes(status as Status)} />
          ) : (
            <ListView items={filtered} />
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
