/**
 * The live workspace (SSE from `/api/events`): every file the AI writes arrives here with its problems, so screens
 * refresh on their own. One connection for the whole app, shared among listeners; the browser reconnects by itself
 * if the server restarts. EventSource cannot send headers, so the session token goes in the query string (the only
 * route that accepts it there).
 */

import { useEffect, useRef } from 'react'
import { sessionToken } from './api'

export interface FileEvent {
  type: 'file'
  file: string
  application?: string
  kind: string
  problems: string[]
  exists: boolean
}

export interface AgentEvent {
  type: 'agent'
  payload: unknown
}

type Listener = (e: FileEvent | AgentEvent) => void
const listeners = new Set<Listener>()
let source: EventSource | null = null

function connect() {
  if (source || typeof EventSource === 'undefined') return
  source = new EventSource(`/api/events?token=${encodeURIComponent(sessionToken())}`)
  for (const type of ['file', 'agent'] as const) {
    source.addEventListener(type, (m) => {
      try {
        const event = JSON.parse((m as MessageEvent).data) as FileEvent | AgentEvent
        for (const listen of listeners) listen(event)
      } catch {
        /* malformed event: the next one will come */
      }
    })
  }
}

export function useServerEvents(onEvent: Listener) {
  const ref = useRef(onEvent)
  ref.current = onEvent
  useEffect(() => {
    const listen: Listener = (e) => ref.current(e)
    listeners.add(listen)
    connect()
    return () => {
      listeners.delete(listen)
      if (listeners.size === 0 && source) {
        source.close()
        source = null
      }
    }
  }, [])
}

/** Calls `reload` (debounced) when a file of this application — or any application, without a slug — changes. */
export function useLiveReload(reload: () => unknown, application?: string) {
  const timer = useRef<number | undefined>(undefined)
  useServerEvents((e) => {
    if (e.type !== 'file') return
    if (application ? e.application !== application : !e.application) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void reload(), 250)
  })
}
