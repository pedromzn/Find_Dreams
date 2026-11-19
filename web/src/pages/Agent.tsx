/**
 * "Your AI": the agents the app can start (phase 4), the instructions installed in the workspace (and any edit the
 * update did not overwrite), and the requests handed to the AI so far.
 */

import { useState } from 'react'
import { CheckCircle, Clock, Trash } from '@phosphor-icons/react'
import type { CreatedRequest, KitStatus } from '@shared/api'
import type { AgentRequest } from '@shared/request'
import { Badge, Button, Command, Empty, Header, Loading, Panel, Problems, ScreenError } from '@/components/ui'
import { Dialog } from '@/components/Dialog'
import { format, useLanguage, useT } from '@/i18n'
import { api, useData } from '@/lib/api'
import { useServerEvents } from '@/lib/events'
import { AgentConnections } from '@/agent/AgentConnections'

type RequestRow = { id: string; request: AgentRequest | null; problems: string[] }

export default function Agent() {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const kit = useData<KitStatus>('/api/agent-kit')
  const requests = useData<RequestRow[]>('/api/requests')
  const [shown, setShown] = useState<CreatedRequest | null>(null)
  useServerEvents((e) => {
    if (e.type === 'file' && e.kind === 'request') void requests.reload()
  })

  if (kit.error) return <ScreenError error={kit.error} onRetry={kit.reload} />
  if (!kit.data || !requests.data) return <Loading />

  const resolve = async (file: string, choice: 'replace' | 'keep') => {
    await api.post('/api/agent-kit/resolve', { file, choice })
    await kit.reload()
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Header title={t.agent.title} note={t.agent.note} />
      <AgentConnections />

      <Panel className="flex flex-col gap-3 p-6">
        <h2 className="text-xl">{t.agent.kit}</h2>
        <p className="text-muted">{t.agent.kitNote(kit.data.installed ?? kit.data.version)}</p>
        {kit.data.conflicts.length > 0 && (
          <div className="flex flex-col gap-2 rounded-tile border border-warning/40 bg-warning/5 p-4">
            <p className="text-sm text-warning">{t.agent.kitConflicts}</p>
            {kit.data.conflicts.map((file) => (
              <div key={file} className="flex flex-wrap items-center justify-between gap-2">
                <code className="font-mono text-sm text-text">{file}</code>
                <div className="flex gap-2">
                  <Button size="small" variant="ghost" onClick={() => resolve(file, 'keep')}>
                    {t.agent.keepMine}
                  </Button>
                  <Button size="small" variant="subtle" onClick={() => resolve(file, 'replace')}>
                    {t.agent.useNew}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3 p-6">
        <h2 className="text-xl">{t.agent.requests}</h2>
        {requests.data.length === 0 ? (
          <Empty title={t.agent.noRequests} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {requests.data.map(({ id, request, problems }) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                {request ? (
                  <div className="min-w-0">
                    <p className="text-text">
                      {t.agent.tasks[request.task]}
                      {request.application && (
                        <span className="ml-2 font-mono text-xs text-faint">{request.application}</span>
                      )}
                    </p>
                    <p className="text-xs text-faint">{format.date(request.createdAt)}</p>
                  </div>
                ) : (
                  <Problems problems={problems} file={`requests/${id}.json`} />
                )}
                <div className="flex items-center gap-2">
                  {request &&
                    (request.status === 'done' ? (
                      <Badge tone="success">
                        <CheckCircle size={14} weight="fill" aria-hidden />
                        {t.agent.done}
                      </Badge>
                    ) : (
                      <Badge>
                        <Clock size={14} aria-hidden />
                        {t.agent.pending}
                      </Badge>
                    ))}
                  {request && (
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={async () =>
                        setShown(await api.get<CreatedRequest>(`/api/requests/${id}/prompt?language=${language}`))
                      }
                    >
                      {t.agent.showPrompt}
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="ghost"
                    aria-label={t.general.delete}
                    onClick={async () => {
                      await api.del(`/api/requests/${id}`)
                      await requests.reload()
                    }}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog
        open={shown !== null}
        onClose={() => setShown(null)}
        title={shown ? t.agent.tasks[shown.request.task] : ''}
      >
        {shown && (
          <>
            <p className="text-sm text-muted">{t.agent.copyNote}</p>
            <Command label={t.agent.folder} text={shown.folder} />
            <Command label={t.agent.prompt} text={shown.prompt} />
          </>
        )}
      </Dialog>
    </div>
  )
}
