/**
 * Live updates: the workspace is watched, and every change to a file the app validates is broadcast to the page (SSE
 * on `/api/events`) with its problems, so the screen refreshes while the AI writes and the person sees mistakes as
 * they happen. Also the bus for the agent's streaming (phase 4).
 *
 * `fs.watch` with `recursive` works on macOS, Windows and Linux (Node ≥ 20). Bursts are debounced per file: an
 * editor or an atomic rename can fire several events for one save.
 */

import { existsSync, mkdirSync, watch, type FSWatcher } from 'node:fs'
import type { Response } from 'express'
import { classify } from '../../shared/workspace.js'
import { config } from '../config.js'
import { checkFile } from '../store/workspace.js'

export type ServerEvent =
  | { type: 'file'; file: string; application?: string; kind: string; problems: string[]; exists: boolean }
  | { type: 'agent'; payload: unknown }

const clients = new Set<Response>()

export function subscribe(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  })
  res.write(': connected\n\n')
  clients.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
  res.on('close', () => {
    clearInterval(ping)
    clients.delete(res)
  })
}

export function broadcast(event: ServerEvent) {
  const line = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  for (const client of clients) client.write(line)
}

let watcher: FSWatcher | null = null
const pending = new Map<string, NodeJS.Timeout>()

/** Starts watching the workspace (idempotent). Returns a stop function. */
export function watchWorkspace(onChange?: (file: string) => void): () => void {
  if (watcher) return stopWatching
  if (!existsSync(config.workspaceFolder)) mkdirSync(config.workspaceFolder, { recursive: true })
  watcher = watch(config.workspaceFolder, { recursive: true }, (_type, name) => {
    if (!name) return
    const file = name.toString().replaceAll('\\', '/')
    if (file.startsWith('.mzn/') || file.endsWith('.tmp')) return
    clearTimeout(pending.get(file))
    pending.set(
      file,
      setTimeout(() => {
        pending.delete(file)
        const kind = classify(file)
        if (!kind) return
        const report = checkFile(file)
        const exists = report?.problems[0] !== 'File not found.'
        broadcast({
          type: 'file',
          file,
          kind: kind.kind,
          ...(kind.application ? { application: kind.application } : {}),
          problems: exists ? (report?.problems ?? []) : [],
          exists,
        })
        onChange?.(file)
      }, 150),
    )
  })
  watcher.on('error', () => stopWatching())
  return stopWatching
}

export function stopWatching() {
  watcher?.close()
  watcher = null
  for (const t of pending.values()) clearTimeout(t)
  pending.clear()
}
