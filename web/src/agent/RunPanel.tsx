/** A run in progress: what the agent says, the tools it uses, the permissions it asks for, and the outcome. */

import { CheckCircle, CircleNotch, Prohibit, ShieldWarning, WarningCircle, Wrench } from '@phosphor-icons/react'
import { Button, join } from '@/components/ui'
import { useT } from '@/i18n'
import { api } from '@/lib/api'
import type { Run } from './useAgents'

export function RunPanel({ run }: { run: Run }) {
  const t = useT()
  const active = run.status === 'starting' || run.status === 'running'
  return (
    <div className="flex flex-col gap-3 rounded-tile border border-border bg-bg p-4">
      <p className="flex items-center gap-2 text-sm">
        {active && <CircleNotch size={16} className="animate-spin text-accent-text" aria-hidden />}
        {run.status === 'done' && <CheckCircle size={16} weight="fill" className="text-success" aria-hidden />}
        {run.status === 'failed' && <WarningCircle size={16} weight="fill" className="text-danger" aria-hidden />}
        {run.status === 'cancelled' && <Prohibit size={16} className="text-muted" aria-hidden />}
        <span className={join(run.status === 'failed' ? 'text-danger' : 'text-text')}>
          {active
            ? t.agent.running
            : run.status === 'done'
              ? t.agent.runDone
              : run.status === 'failed'
                ? t.agent.runFailed
                : t.agent.runCancelled}
        </span>
        {active && (
          <Button
            size="small"
            variant="ghost"
            className="ml-auto"
            onClick={() => api.post(`/api/runs/${run.id}/cancel`)}
          >
            {t.agent.cancel}
          </Button>
        )}
      </p>
      {run.error && <p className="font-mono text-xs break-words text-danger">{run.error}</p>}
      {run.permissions.map((p) => (
        <div
          key={p.id}
          className="flex flex-col gap-2 rounded-tile border border-warning/40 bg-warning/5 p-3"
          role="alert"
        >
          <p className="flex items-center gap-2 text-sm text-warning">
            <ShieldWarning size={16} aria-hidden />
            {t.agent.permissionAsk} <span className="text-text">{p.title}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {p.options.map((o) => (
              <Button
                key={o.id}
                size="small"
                variant={o.kind.startsWith('allow') ? 'subtle' : 'ghost'}
                onClick={() => api.post(`/api/runs/${run.id}/permission`, { permissionId: p.id, optionId: o.id })}
              >
                {o.name}
              </Button>
            ))}
          </div>
        </div>
      ))}
      {run.tools.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted">
          {run.tools.slice(-8).map((tool) => (
            <li key={tool.id} className="flex items-center gap-2">
              <Wrench size={12} aria-hidden />
              <span className="truncate">{tool.title}</span>
              <span className="ml-auto text-faint">{tool.status}</span>
            </li>
          ))}
        </ul>
      )}
      {run.text && <p className="max-h-60 overflow-y-auto text-sm whitespace-pre-wrap text-text">{run.text}</p>}
    </div>
  )
}
