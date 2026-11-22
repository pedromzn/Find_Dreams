/**
 * The local API's lock. The server listens on 127.0.0.1, but that does not make it private: any website open in the
 * person's browser can send requests to 127.0.0.1, and this API serves a CV, salary expectations and recruiter
 * messages. Two checks close that:
 *
 * 1. **Host and Origin** (every request, page included): a DNS-rebinding attack reaches us under the attacker's
 *    hostname, so only `127.0.0.1`, `localhost` and `[::1]` are accepted; a cross-site request carries a foreign
 *    `Origin`, which is refused.
 * 2. **A per-session token** on every `/api` route, in the `X-MZN-Token` header. A custom header also forces a CORS
 *    preflight, which this server never approves. The token reaches the page through a `<meta>` tag in the
 *    `index.html` the server itself serves (same origin: another site cannot read it), so it works the same in the
 *    browser (dev) and in the Electron window.
 *
 * The token is random per process (or `MZN_API_TOKEN`, for a fixed one in development — removed from the environment as
 * soon as it is read, so no child process inherits it). Rotating it is a restart.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'

export const TOKEN_HEADER = 'x-mzn-token'
export const TOKEN_META = 'mzn-token'

export const sessionToken: string = process.env.MZN_API_TOKEN || randomBytes(32).toString('base64url')
// never leave it in the environment: every agent the app starts inherits it, and the AI must not get the page's session
delete process.env.MZN_API_TOKEN

/**
 * A second, narrow token for the AI's validator (`.mzn/session.json`): it opens `POST /api/validate` and nothing else.
 * The AI can read that file; it must not get the page's session, which reads the CV, the salary and the messages.
 */
export const validateToken: string = randomBytes(32).toString('base64url')

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** `127.0.0.1:3060` → `127.0.0.1`; `[::1]:3060` → `[::1]`. Null when the header is malformed. */
function hostname(host: string | undefined): string | null {
  if (!host) return null
  const m = /^(\[[0-9a-f:]+\]|[^:]+)(?::\d{1,5})?$/i.exec(host.trim())
  return m ? m[1]!.toLowerCase() : null
}

/** Refuses requests whose Host is not a loopback name, or whose Origin is a different site. */
export const checkHostAndOrigin: RequestHandler = (req, res, next) => {
  const host = req.headers.host
  const name = hostname(host)
  if (!name || !LOCAL_HOSTNAMES.has(name)) {
    res.status(403).json({ error: 'Forbidden host.', code: 'forbidden_host' })
    return
  }
  const origin = req.headers.origin
  if (origin !== undefined) {
    let same = false
    try {
      const url = new URL(origin)
      same = (url.protocol === 'http:' || url.protocol === 'https:') && url.host === host
    } catch {
      same = false
    }
    if (!same) {
      res.status(403).json({ error: 'Forbidden origin.', code: 'forbidden_origin' })
      return
    }
  }
  next()
}

function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Every `/api` route requires the session token. */
export function requireToken(expected: string = sessionToken, narrow: string = validateToken): RequestHandler {
  return (req, res, next) => {
    // EventSource cannot send headers: only the event stream takes the token in the query string
    const fromQuery = req.method === 'GET' && req.path === '/events' ? req.query.token : undefined
    const given = req.headers[TOKEN_HEADER] ?? fromQuery
    const validator =
      req.method === 'POST' && req.path === '/validate' && typeof given === 'string' && sameToken(given, narrow)
    if (!validator && (typeof given !== 'string' || !sameToken(given, expected))) {
      res.status(401).json({ error: 'Missing or wrong session token.', code: 'unauthorized' })
      return
    }
    next()
  }
}

/** Puts the token in the page, right after `<head>`. */
export function injectToken(html: string, token: string = sessionToken): string {
  return html.replace(/<head>/i, `<head>\n    <meta name="${TOKEN_META}" content="${token}" />`)
}
