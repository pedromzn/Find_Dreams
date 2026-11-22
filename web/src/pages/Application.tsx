/**
 * One application: a header with the company, the role, the facts and the two scores (fit and ATS); the tabs (summary,
 * fit, résumé, letter, company, messages, interviews, timeline); and a side column with the apply kit — what is ready
 * to apply, and the one-click ways to get the rest. The app never applies: "mark as applied" records that the person
 * did.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowSquareOut,
  CheckCircle,
  Circle,
  CurrencyCircleDollar,
  MapPin,
  Microphone,
  NotePencil,
  PaperPlaneTilt,
  Target,
  Trash,
} from '@phosphor-icons/react'
import type { ApplicationDetail, OverviewApplication } from '@shared/api'
import { STATUSES, type Status } from '@shared/application'
import {
  Badge,
  Button,
  LinkButton,
  Loading,
  Panel,
  Problems,
  ScoreRing,
  ScreenError,
  Section,
  Select,
  Tabs,
} from '@/components/ui'
import { useLanguage, useT } from '@/i18n'
import { api, useData } from '@/lib/api'
import { useLiveReload } from '@/lib/events'
import { useOverview } from '@/lib/overview'
import { SummaryTab } from '@/application/SummaryTab'
import { CompanyTab, FitTab, InterviewsTab, MessagesTab, TimelineTab } from '@/application/Tabs'
import { formatPay, stageColor } from '@/application/labels'
import { AgentActions, AiButton, MessageActions } from '@/agent/AgentActions'
import { LetterEditor } from '@/letter/LetterEditor'
import { TailoredPreview } from '@/pages/Resumes'
import { CompanyTile } from '@/pages/Board'
import { LANGUAGE_DATA } from '@shared/languages'

const TABS = ['summary', 'fit', 'resume', 'letter', 'company', 'messages', 'interviews', 'timeline'] as const
type Tab = (typeof TABS)[number]

function KitItem({ done, label, action }: { done: boolean; label: string; action?: React.ReactNode }) {
  return (
    <li className="flex min-h-9 items-center gap-2.5">
      {done ? (
        <CheckCircle size={19} weight="fill" className="shrink-0 text-success" />
      ) : (
        <Circle size={19} className="shrink-0 text-border-strong" />
      )}
      <span className={`flex-1 text-[14px] ${done ? 'text-text' : 'text-muted'}`}>{label}</span>
      {!done && action}
    </li>
  )
}

function Kit({
  d,
  extra,
  goTo,
  reload,
  save,
}: {
  d: ApplicationDetail
  extra: OverviewApplication | undefined
  goTo: (tab: Tab) => void
  reload: () => void
  save: (patch: object) => Promise<void>
}) {
  const t = useT()
  const a = d.application!
  const k = t.application.kitItems
  const small = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="text-[13px] font-medium text-accent-text hover:underline">
      {label}
    </button>
  )
  return (
    <Section title={t.application.kit} note={t.application.kitNote}>
      <ul className="flex flex-col gap-0.5">
        <KitItem done={d.job !== null} label={k.job} />
        <KitItem
          done={d.fit !== null}
          label={k.fit}
          action={
            <AiButton
              task="analyze-fit"
              application={d.slug}
              size="small"
              variant="ghost"
              label={t.tools.run}
              onDone={reload}
            />
          }
        />
        <KitItem done={d.resume !== null} label={k.resume} action={small(t.tools.open, () => goTo('resume'))} />
        <KitItem done={d.letter !== null} label={k.letter} action={small(t.tools.open, () => goTo('letter'))} />
        <KitItem
          done={d.salary !== null}
          label={k.salary}
          action={
            <AiButton
              task="salary-research"
              application={d.slug}
              size="small"
              variant="ghost"
              label={t.tools.run}
              onDone={reload}
            />
          }
        />
      </ul>
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        {a.url && (
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-tile border border-border bg-surface-2 text-[14.5px] font-medium text-text no-underline hover:border-border-strong"
          >
            <ArrowSquareOut size={17} />
            {t.application.openPost}
          </a>
        )}
        {a.status === 'saved' && (
          <Button
            icon={<PaperPlaneTilt size={17} />}
            onClick={() => void save({ status: 'applied', appliedAt: new Date().toISOString().slice(0, 10) })}
          >
            {t.application.markApplied}
          </Button>
        )}
      </div>
      {extra && extra.ats !== null && (
        <p className="mt-3 text-[12.5px] text-faint">
          ATS {extra.ats} · {t.ats.level(extra.ats)}
        </p>
      )}
    </Section>
  )
}

export default function Application() {
  const { slug = '' } = useParams()
  const t = useT()
  const locale = LANGUAGE_DATA[useLanguage((s) => s.language)].bcp47
  const navigate = useNavigate()
  const detail = useData<ApplicationDetail>(`/api/applications/${slug}`)
  const overview = useOverview()
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'summary'
  const setTab = (next: Tab) => setParams(next === 'summary' ? {} : { tab: next }, { replace: true })
  const [confirming, setConfirming] = useState(false)
  useLiveReload(detail.reload, slug)

  if (detail.error) {
    return (
      <ScreenError
        error={detail.error.status === 404 ? { message: t.application.notFound } : detail.error}
        onRetry={detail.reload}
      />
    )
  }
  if (!detail.data) return <Loading />
  const d = detail.data
  const a = d.application
  const extra = overview.data?.applications.find((x) => x.slug === slug)

  const save = async (patch: object) => {
    await api.patch(`/api/applications/${slug}`, patch)
    await detail.reload()
  }

  if (!a) {
    return (
      <Panel className="mx-auto mt-6 flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-2xl">{t.application.brokenTitle}</h1>
        <p className="text-muted">{t.application.brokenNote}</p>
        <Problems problems={d.problems} file={`applications/${slug}/application.json`} />
        <AgentActions slug={slug} only={['fix-files']} onDone={detail.reload} />
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-[13px] text-faint">
        <Link to="/applications" className="text-faint no-underline hover:text-text">
          {t.nav.board}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-muted">{a.company}</span>
      </nav>

      <Panel className="relative overflow-hidden p-5 sm:p-6">
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: stageColor(a.status) }} aria-hidden />
        <div className="flex flex-wrap items-start gap-5">
          <CompanyTile name={a.company} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-muted">{a.company}</p>
            <h1 className="text-[clamp(1.5rem,2.6vw,2.1rem)]">{a.role}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {a.location && (
                <Badge>
                  <MapPin size={13} aria-hidden />
                  {a.location}
                </Badge>
              )}
              {a.workModel && <Badge>{t.workModel[a.workModel]}</Badge>}
              {a.seniority && <Badge>{t.seniority[a.seniority]}</Badge>}
              {a.salary && (
                <Badge tone="success">
                  <CurrencyCircleDollar size={13} aria-hidden />
                  {formatPay(a.salary, locale, t.newApplication.periods[a.salary.period])}
                </Badge>
              )}
              <Badge>{t.source[a.source]}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setTab('fit')}
              className="flex flex-col items-center gap-1"
              title={t.application.fitScore}
            >
              <ScoreRing value={d.fit?.score ?? null} size={64} label={t.application.fitScore} />
              <span className="text-[12px] text-faint">{t.application.fitScore}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('resume')}
              className="flex flex-col items-center gap-1"
              title={t.ats.title}
            >
              <ScoreRing value={extra?.ats ?? null} size={64} label={t.ats.title} />
              <span className="text-[12px] text-faint">ATS</span>
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Select
            value={a.status}
            onChange={(e) => void save({ status: e.target.value as Status })}
            aria-label={t.application.status}
            className="w-auto !py-1.5"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </Select>
          <LinkButton to={`/applications/${slug}/practice`} size="small" icon={<Microphone size={16} />}>
            {t.interview.practice}
          </LinkButton>
          <LinkButton
            to={`/applications/${slug}/debrief`}
            size="small"
            variant="subtle"
            icon={<NotePencil size={16} />}
          >
            {t.interview.debrief}
          </LinkButton>
          <div className="ml-auto flex items-center gap-2">
            {confirming ? (
              <>
                <span className="text-sm text-muted">{t.application.deleteConfirm}</span>
                <Button
                  variant="danger"
                  size="small"
                  onClick={async () => {
                    await api.del(`/api/applications/${slug}`)
                    navigate('/applications')
                  }}
                >
                  {t.application.deleteYes}
                </Button>
                <Button variant="ghost" size="small" onClick={() => setConfirming(false)}>
                  {t.general.cancel}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="small"
                onClick={() => setConfirming(true)}
                aria-label={t.application.delete}
                title={t.application.delete}
              >
                <Trash size={17} />
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Tabs<Tab>
            label={t.application.tabsLabel}
            current={tab}
            onChange={setTab}
            tabs={[
              { id: 'summary', label: t.application.tabs.summary },
              { id: 'fit', label: t.application.tabs.fit },
              { id: 'resume', label: t.application.tabs.resume },
              { id: 'letter', label: t.application.tabs.letter },
              { id: 'company', label: t.application.tabs.company },
              { id: 'messages', label: t.application.tabs.messages, count: d.messages.length },
              {
                id: 'interviews',
                label: t.application.tabs.interviews,
                count: d.interviews.length + d.debriefs.length,
              },
              { id: 'timeline', label: t.application.tabs.timeline },
            ]}
          />
          <div role="tabpanel">
            {tab === 'summary' && <SummaryTab detail={d} a={a} save={save} />}
            {tab === 'fit' && (
              <FitTab detail={d} actions={<AgentActions slug={slug} only={['analyze-fit']} onDone={detail.reload} />} />
            )}
            {tab === 'resume' && <TailoredPreview slug={slug} />}
            {tab === 'letter' && <LetterEditor detail={d} reload={detail.reload} />}
            {tab === 'company' && (
              <CompanyTab
                detail={d}
                actions={<AgentActions slug={slug} only={['research-company']} onDone={detail.reload} />}
              />
            )}
            {tab === 'messages' && (
              <MessagesTab
                detail={d}
                onSaved={detail.reload}
                actions={(message) => <MessageActions slug={slug} message={message} onDone={detail.reload} />}
              />
            )}
            {tab === 'interviews' && (
              <InterviewsTab
                detail={d}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <LinkButton to={`/applications/${slug}/practice`} icon={<Microphone size={18} />}>
                      {t.interview.practice}
                    </LinkButton>
                    <LinkButton to={`/applications/${slug}/debrief`} variant="subtle" icon={<NotePencil size={18} />}>
                      {t.interview.debrief}
                    </LinkButton>
                  </div>
                }
              />
            )}
            {tab === 'timeline' && <TimelineTab detail={d} />}
          </div>
        </div>
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
          <Kit d={d} extra={extra} goTo={setTab} reload={detail.reload} save={save} />
          {d.fit && d.fit.talkingPoints.length > 0 && (
            <Section title={t.application.talkingPoints}>
              <ul className="flex flex-col gap-2 text-[13.5px] text-muted">
                {d.fit.talkingPoints.slice(0, 3).map((p) => (
                  <li key={p} className="flex gap-2">
                    <Target size={15} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </div>
  )
}
