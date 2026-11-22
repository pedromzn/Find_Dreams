/**
 * The desktop app's own settings, pure (no Electron import) so they are testable: where the workspace is, the
 * Content-Security-Policy of the window, and what a link may open.
 *
 * The workspace choice lives in `userData/desktop.json`, outside the workspace itself (it says where the workspace is).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface DesktopSettings {
  workspace: string | null
}

export function readSettings(userData: string): DesktopSettings {
  try {
    const raw = JSON.parse(readFileSync(path.join(userData, 'desktop.json'), 'utf8')) as Partial<DesktopSettings>
    return { workspace: typeof raw.workspace === 'string' && raw.workspace ? raw.workspace : null }
  } catch {
    return { workspace: null }
  }
}

export function writeSettings(userData: string, settings: DesktopSettings): void {
  mkdirSync(userData, { recursive: true })
  writeFileSync(path.join(userData, 'desktop.json'), `${JSON.stringify(settings, null, 2)}\n`)
}

/** The default folder's name, and the one the app had before it was renamed (data already there is kept). */
export const WORKSPACE_NAME = 'Find Dreams'
const LEGACY_WORKSPACE_NAME = 'MZN Vagas'

/**
 * `~/Documents/Find Dreams` unless the person chose another folder. Created if missing. Someone who used the app as
 * "MZN Vagas" keeps their `~/Documents/MZN Vagas` folder: the rename must never hide their data.
 */
export function resolveWorkspace(userData: string, documents: string): string {
  const chosen = readSettings(userData).workspace
  const current = path.join(documents, WORKSPACE_NAME)
  const legacy = path.join(documents, LEGACY_WORKSPACE_NAME)
  const fallback = !existsSync(current) && existsSync(legacy) ? legacy : current
  const folder = chosen && path.isAbsolute(chosen) ? chosen : fallback
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
  return folder
}

/**
 * The window's CSP (production only: Vite's dev server needs inline scripts). Everything comes from the app's own
 * origin; audio plays from blob URLs (the interviewer's voice); no frames, no plugins, no inline scripts.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

/** A link the page asks to open: only http(s) goes to the system browser; everything else is dropped. */
export function externalUrl(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/** Whether a navigation stays inside the app (the local server's own origin). */
export const isAppUrl = (url: string, origin: string) => {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}
