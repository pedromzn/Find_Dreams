/** The agents the server detected, the selected one, and the live runs (from the event stream). */

import { useEffect, useState } from 'react'
import { useData } from '@/lib/api'
import { useServerEvents } from '@/lib/events'

export interface DetectedAgent {
  id: string
  name: string
  installed: boolean
  via: 'native' | 'npx' | null
  path: string | null
  install: string
  login: string
  needsSecret: string | null
  usesPlanLimits: boolean
}

export interface Run {
  id: string
  requestId: string | null
  agent: string
  status: 'starting' | 'running' | 'done' | 'failed' | 'cancelled'
  startedAt: string
  endedAt: string | null
  text: string
  tools: Array<{ id: string; title: string; status: string }>
  permissions: Array<{ id: string; title: string; options: Array<{ id: string; name: string; kind: string }> }>
  error: string | null
}

export function useAgents() {
  return useData<{ agents: DetectedAgent[]; selected: string | null }>('/api/agents')
}

type Payload = { runId: string; kind: string } & Record<string, unknown>

/** A run kept in step with the server: the initial snapshot, then every event applied as it arrives. */
export function useRun(initial: Run | null): Run | null {
  const [run, setRun] = useState(initial)
  useEffect(() => setRun(initial), [initial])
  useServerEvents((e) => {
    if (e.type !== 'agent') return
    const p = e.payload as Payload
    setRun((r) => {
      if (!r || p.runId !== r.id) return r
      const next = { ...r }
      if (p.kind === 'text') next.text += String(p.text)
      else if (p.kind === 'tool') {
        const id = String(p.id)
        const known = next.tools.find((t) => t.id === id)
        next.tools = known
          ? next.tools.map((t) =>
              t.id === id ? { ...t, status: String(p.status), title: String(p.title || t.title) } : t,
            )
          : [...next.tools, { id, title: String(p.title), status: String(p.status) }]
      } else if (p.kind === 'permission')
        next.permissions = [...next.permissions, p as unknown as Run['permissions'][number]]
      else if (p.kind === 'permission_resolved') next.permissions = next.permissions.filter((x) => x.id !== p.id)
      else if (p.kind === 'status') {
        next.status = p.status as Run['status']
        next.error = (p.error as string | null) ?? null
        if (next.status !== 'running') next.permissions = []
      }
      return next
    })
  })
  return run
}
