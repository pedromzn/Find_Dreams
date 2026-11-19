/**
 * Runs a request with the connected agent, inside the hand-off dialog. Without a usable agent selected, nothing shows:
 * the dialog's copy-the-prompt part is the way.
 */

import { useEffect, useState } from 'react'
import { Play } from '@phosphor-icons/react'
import type { AgentRequest } from '@shared/request'
import { Button, ErrorLine } from '@/components/ui'
import { useT } from '@/i18n'
import { api } from '@/lib/api'
import { RunPanel } from './RunPanel'
import { useAgents, useRun, type Run } from './useAgents'

export function RunWithAgent({ request, onFinished }: { request: AgentRequest; onFinished: () => void }) {
  const t = useT()
  const agents = useAgents()
  const [started, setStarted] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = useRun(started)
  useEffect(() => {
    if (run?.status === 'done') onFinished()
    // only on the transition to done
  }, [run?.status])

  const agent = agents.data?.agents.find((a) => a.id === agents.data?.selected)
  if (!agent || !agent.installed || agent.needsSecret) return null

  return (
    <div className="flex flex-col gap-3">
      {!run ? (
        <Button
          icon={<Play size={18} weight="fill" />}
          onClick={async () => {
            setError(null)
            try {
              setStarted(await api.post<Run>('/api/runs', { requestId: request.id }))
            } catch (e) {
              setError((e as Error).message)
            }
          }}
        >
          {t.agent.run(agent.name)}
        </Button>
      ) : (
        <RunPanel run={run} />
      )}
      <ErrorLine message={error} />
      <p className="text-sm text-faint">{t.agent.orCopy}</p>
    </div>
  )
}
