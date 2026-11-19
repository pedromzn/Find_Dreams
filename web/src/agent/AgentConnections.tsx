/**
 * The agents the app can start through ACP: which are installed (looked up on the shell PATH), which one is in use,
 * a connection test with its latency, and the API keys for the agents that take one.
 */

import { useState } from 'react'
import { ArrowSquareOut, CheckCircle, Key } from '@phosphor-icons/react'
import { Badge, Button, ErrorLine, Input, Loading, Panel, join } from '@/components/ui'
import { useT } from '@/i18n'
import { api, useData } from '@/lib/api'
import { useAgents, type DetectedAgent } from './useAgents'

type TestResult = { ok: boolean; latencyMs: number; answer: string; error: string | null }

function AgentRow({ agent, selected, onSelect }: { agent: DetectedAgent; selected: boolean; onSelect: () => void }) {
  const t = useT()
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <li className={join('flex flex-col gap-2 rounded-tile border p-4', selected ? 'border-accent' : 'border-border')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-text">{agent.name}</span>
        {agent.via === 'native' ? (
          <Badge tone="success">
            <CheckCircle size={14} weight="fill" aria-hidden />
            {t.agent.installed}
          </Badge>
        ) : agent.via === 'npx' ? (
          <Badge>{t.agent.viaNpx}</Badge>
        ) : (
          <Badge>{t.agent.notInstalled}</Badge>
        )}
        <div className="ml-auto flex gap-2">
          {agent.installed && (
            <Button
              size="small"
              variant="ghost"
              disabled={testing || Boolean(agent.needsSecret)}
              onClick={async () => {
                setTesting(true)
                setError(null)
                setResult(null)
                try {
                  setResult(await api.post<TestResult>(`/api/agents/${agent.id}/test`))
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setTesting(false)
                }
              }}
            >
              {testing ? t.agent.testing : t.agent.test}
            </Button>
          )}
          {agent.installed &&
            (selected ? (
              <Badge tone="accent">{t.agent.inUse}</Badge>
            ) : (
              <Button size="small" variant="subtle" onClick={onSelect}>
                {t.agent.use}
              </Button>
            ))}
        </div>
      </div>
      <p className="text-sm text-muted">{t.agent.logins[agent.id] ?? agent.login}</p>
      {agent.needsSecret && <p className="text-sm text-warning">{t.agent.needsKey}</p>}
      {!agent.installed && (
        <a
          href={agent.install}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm"
        >
          {t.agent.howToInstall} <ArrowSquareOut size={14} aria-hidden />
        </a>
      )}
      {result && (
        <p className={join('text-sm', result.ok ? 'text-success' : 'text-danger')}>
          {result.ok ? t.agent.testOk(result.latencyMs) : `${t.agent.testFailed} ${result.error ?? ''}`}
        </p>
      )}
      <ErrorLine message={error} />
    </li>
  )
}

function Keys() {
  const t = useT()
  const keys = useData<Record<string, boolean>>('/api/secrets')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  if (!keys.data) return null
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 font-sans text-sm font-medium text-text">
        <Key size={16} aria-hidden />
        {t.agent.keys}
      </h3>
      <p className="text-sm text-muted">{t.agent.keysNote}</p>
      {Object.entries(keys.data).map(([name, set]) => (
        <form
          key={name}
          className="flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            await api.put(`/api/secrets/${name}`, { value: drafts[name] ?? '' })
            setDrafts((d) => ({ ...d, [name]: '' }))
            await keys.reload()
          }}
        >
          <code className="w-44 font-mono text-xs text-muted">{name}</code>
          <Badge tone={set ? 'success' : 'neutral'}>{set ? t.agent.keySet : t.agent.keyNotSet}</Badge>
          <Input
            type="password"
            autoComplete="off"
            className="w-64"
            aria-label={name}
            value={drafts[name] ?? ''}
            onChange={(e) => setDrafts((d) => ({ ...d, [name]: e.target.value }))}
          />
          <Button type="submit" size="small" variant="subtle" disabled={!drafts[name]}>
            {t.agent.saveKey}
          </Button>
          {set && (
            <Button
              size="small"
              variant="ghost"
              onClick={async () => {
                await api.put(`/api/secrets/${name}`, { value: null })
                await keys.reload()
              }}
            >
              {t.agent.clearKey}
            </Button>
          )}
        </form>
      ))}
    </div>
  )
}

export function AgentConnections() {
  const t = useT()
  const agents = useAgents()
  return (
    <Panel className="flex flex-col gap-4 p-6">
      <h2 className="text-xl">{t.agent.connect}</h2>
      <p className="text-muted">{t.agent.connectNote}</p>
      {!agents.data ? (
        <Loading />
      ) : (
        <ul className="flex flex-col gap-2">
          {agents.data.agents.map((a) => (
            <AgentRow
              key={a.id}
              agent={a}
              selected={agents.data!.selected === a.id}
              onSelect={async () => {
                await api.put('/api/agents/selected', { id: a.id })
                await agents.reload()
              }}
            />
          ))}
        </ul>
      )}
      <Keys />
    </Panel>
  )
}
