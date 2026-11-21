/**
 * Find jobs: the person describes what they want, their AI searches public job pages (`find-jobs`) and writes a list;
 * here the person triages it. "Save" captures the post from its link and creates an application — nothing is ever
 * applied to.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowSquareOut,
  BookmarkSimple,
  Compass,
  MagnifyingGlass,
  X,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import type { CapturedJob, DiscoveryFile } from '@shared/api'
import type { Application } from '@shared/application'
import type { DiscoveredJob } from '@shared/discovery'
import {
  Badge,
  Button,
  Empty,
  ErrorLine,
  Header,
  Loading,
  Panel,
  Problems,
  ScoreRing,
  ScreenError,
  Section,
  TextArea,
} from '@/components/ui'
import { format, useT } from '@/i18n'
import { api, useData } from '@/lib/api'
import { useAnyFileReload } from '@/lib/events'
import { AiButton } from '@/agent/AgentActions'
import { CompanyTile } from '@/pages/Board'

function JobCard({
  job,
  file,
  index,
  onChanged,
}: {
  job: DiscoveredJob
  file: string
  index: number
  onChanged: () => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function status(next: DiscoveredJob['status']) {
    await api.patch(`/api/discoveries/${file}/${index}`, { status: next })
    onChanged()
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      let captured: CapturedJob | null = null
      try {
        captured = await api.post<CapturedJob>('/api/jobs/capture', { url: job.url })
      } catch {
        /* a page that needs a login or blocks robots: save with what the search found */
      }
      const created = await api.post<Application>('/api/applications', {
        company: job.company,
        role: job.role,
        url: job.url,
        source: captured?.source ?? 'other',
        location: job.location || captured?.location || '',
        ...(job.workModel
          ? { workModel: job.workModel }
          : captured?.workModel
            ? { workModel: captured.workModel }
            : {}),
        status: 'saved',
        jobMarkdown: captured?.markdown || `# ${job.role} — ${job.company}\n\n${job.why}\n\n${job.url}\n`,
      })
      await status('saved')
      navigate(`/applications/${created.slug}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dismissed = job.status === 'dismissed'
  return (
    <Panel className={`flex flex-col gap-3 p-4 ${dismissed ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <CompanyTile name={job.company} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text">{job.role}</p>
          <p className="text-[13px] text-muted">
            {job.company}
            {job.location && <span className="text-faint"> · {job.location}</span>}
          </p>
        </div>
        <div className="flex flex-col items-center">
          <ScoreRing value={job.match} size={44} stroke={4} label={t.discover.match} />
          <span className="mt-0.5 text-[11px] text-faint">{t.discover.match}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {job.workModel && <Badge>{t.workModel[job.workModel]}</Badge>}
        {job.salary && <Badge tone="success">{job.salary}</Badge>}
        {job.postedAt && <Badge>{format.shortDate(job.postedAt)}</Badge>}
        {job.status === 'saved' && <Badge tone="accent">{t.discover.saved}</Badge>}
      </div>
      <p className="text-[13.5px] leading-relaxed text-muted">{job.why}</p>
      <ErrorLine message={error} />
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {job.status !== 'saved' && !dismissed && (
          <Button size="small" icon={<BookmarkSimple size={16} />} onClick={save} disabled={busy}>
            {busy ? t.discover.saving : t.discover.save}
          </Button>
        )}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-tile border border-border bg-surface-2 px-3 text-[13.5px] font-medium text-text no-underline hover:border-border-strong"
        >
          <ArrowSquareOut size={15} />
          {t.discover.openPost}
        </a>
        {job.status === 'new' && (
          <Button
            variant="ghost"
            size="small"
            icon={<X size={15} />}
            onClick={() => void status('dismissed')}
            className="ml-auto"
          >
            {t.discover.dismiss}
          </Button>
        )}
        {dismissed && (
          <Button
            variant="ghost"
            size="small"
            icon={<ArrowCounterClockwise size={15} />}
            onClick={() => void status('new')}
            className="ml-auto"
          >
            {t.discover.restore}
          </Button>
        )}
      </div>
    </Panel>
  )
}

function Search({ file, onChanged }: { file: DiscoveryFile; onChanged: () => void }) {
  const t = useT()
  const [showDismissed, setShowDismissed] = useState(false)
  if (!file.discovery) return <Problems problems={file.problems} file={`discoveries/${file.name}`} />
  const d = file.discovery
  const jobs = d.jobs.map((job, index) => ({ job, index })).sort((a, b) => b.job.match - a.job.match)
  const dismissed = jobs.filter((j) => j.job.status === 'dismissed')
  const shown = showDismissed ? jobs : jobs.filter((j) => j.job.status !== 'dismissed')
  return (
    <Section
      title={d.criteria}
      note={`${format.date(d.generatedAt)} · ${t.discover.jobs(d.jobs.length)} · ${t.discover.sources}: ${d.sources.join(', ')}`}
      bodyClassName="flex flex-col gap-4"
    >
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {shown.map(({ job, index }) => (
          <JobCard key={job.url + index} job={job} file={file.name} index={index} onChanged={onChanged} />
        ))}
      </div>
      {dismissed.length > 0 && (
        <Button variant="ghost" size="small" className="self-start" onClick={() => setShowDismissed((v) => !v)}>
          {showDismissed ? t.discover.hideDismissed : t.discover.showDismissed(dismissed.length)}
        </Button>
      )}
    </Section>
  )
}

export default function Discover() {
  const t = useT()
  const list = useData<DiscoveryFile[]>('/api/discoveries')
  useAnyFileReload(list.reload)
  const [criteria, setCriteria] = useState('')
  if (list.error) return <ScreenError error={list.error} onRetry={list.reload} />
  if (!list.data) return <Loading />
  return (
    <div className="flex flex-col gap-6">
      <Header title={t.discover.title} note={t.discover.note} />
      <Panel className="flex flex-col gap-3 p-5">
        <label htmlFor="criteria" className="font-medium text-text">
          {t.discover.criteria}
        </label>
        <TextArea
          id="criteria"
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder={t.discover.criteriaPlaceholder}
          className="min-h-20"
        />
        <div className="flex flex-wrap items-center gap-3">
          <AiButton
            task="find-jobs"
            details={criteria.trim()}
            variant="main"
            icon={<MagnifyingGlass size={18} />}
            label={t.discover.search}
            onDone={list.reload}
          />
          <p className="text-[13px] text-faint">{t.discover.criteriaNote}</p>
        </div>
      </Panel>
      {list.data.length === 0 ? (
        <Empty icon={<Compass size={26} />} title={t.discover.none}>
          <p>{t.discover.noneNote}</p>
        </Empty>
      ) : (
        list.data.map((f) => <Search key={f.name} file={f} onChanged={list.reload} />)
      )}
    </div>
  )
}
