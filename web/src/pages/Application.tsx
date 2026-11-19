/** One application: the header with the status, and the tabs (summary, fit, company, messages, interviews, timeline). */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash } from '@phosphor-icons/react'
import type { ApplicationDetail } from '@shared/api'
import { STATUSES, type Status } from '@shared/application'
import { Button, Loading, Panel, Problems, ScreenError, Select, Tabs } from '@/components/ui'
import { useT } from '@/i18n'
import { api, useData } from '@/lib/api'
import { SummaryTab } from '@/application/SummaryTab'
import { CompanyTab, FitTab, InterviewsTab, MessagesTab, TimelineTab } from '@/application/Tabs'
import { AgentActions, MessageActions } from '@/agent/AgentActions'

type Tab = 'summary' | 'fit' | 'company' | 'messages' | 'interviews' | 'timeline'

export default function Application() {
  const { slug = '' } = useParams()
  const t = useT()
  const navigate = useNavigate()
  const detail = useData<ApplicationDetail>(`/api/applications/${slug}`)
  const [tab, setTab] = useState<Tab>('summary')
  const [confirming, setConfirming] = useState(false)

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
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted">{a.company}</p>
          <h1 className="text-[clamp(1.6rem,3vw,2.3rem)]">{a.role}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={a.status}
            onChange={(e) => void save({ status: e.target.value as Status })}
            aria-label={t.application.status}
            className="w-auto"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </Select>
          {confirming ? (
            <>
              <Button
                variant="danger"
                size="small"
                onClick={async () => {
                  await api.del(`/api/applications/${slug}`)
                  navigate('/')
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
              <Trash size={18} />
            </Button>
          )}
        </div>
      </header>
      {confirming && <p className="text-sm text-muted">{t.application.deleteConfirm}</p>}

      <Tabs<Tab>
        label={t.application.tabsLabel}
        current={tab}
        onChange={setTab}
        tabs={[
          { id: 'summary', label: t.application.tabs.summary },
          { id: 'fit', label: t.application.tabs.fit },
          { id: 'company', label: t.application.tabs.company },
          { id: 'messages', label: t.application.tabs.messages, count: d.messages.length },
          { id: 'interviews', label: t.application.tabs.interviews, count: d.interviews.length + d.debriefs.length },
          { id: 'timeline', label: t.application.tabs.timeline },
        ]}
      />

      <div role="tabpanel">
        {tab === 'summary' && <SummaryTab detail={d} a={a} save={save} />}
        {tab === 'fit' && (
          <FitTab detail={d} actions={<AgentActions slug={slug} only={['analyze-fit']} onDone={detail.reload} />} />
        )}
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
            actions={<AgentActions slug={slug} only={['interviews']} onDone={detail.reload} />}
          />
        )}
        {tab === 'timeline' && <TimelineTab detail={d} />}
      </div>
    </div>
  )
}
