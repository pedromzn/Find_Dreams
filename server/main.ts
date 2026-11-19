/**
 * The MZN Vagas server: the API (`/api`) and the web app on the SAME port.
 *
 * - `npm run dev`: Vite runs as middleware (with hot reload) — no second process, no proxy.
 * - `npm start`: serves the already built `dist/`.
 * - the desktop app (Electron main) imports `createApp()` and listens on a random port of its own.
 *
 * There is no login: the app is local and for a single person. It listens on 127.0.0.1, and every request goes
 * through the Host/Origin check and every `/api` route through the session token (`security.ts`), because any
 * website open in the browser can try to call 127.0.0.1 — and this API serves a CV and salary expectations.
 */

import express from 'express'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import '../shared/zodPortuguese.js'
import { config } from './config.js'
import { apiRouter } from './api.js'
import { handleError } from './errors.js'
import { checkHostAndOrigin, injectToken, requireToken, sessionToken } from './security.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** The guarded API: Host/Origin on everything, the token on `/api`. Shared with the tests, so they test the real lock. */
export function mountApi(app: express.Express, token: string = sessionToken): express.Express {
  app.disable('x-powered-by')
  app.use(checkHostAndOrigin)
  app.use('/api', requireToken(token))
  app.use(express.json({ limit: '1mb' }))
  app.use('/api', apiRouter)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route not found.', code: 'not_found' }))
  app.use('/api', handleError)
  return app
}

export async function createApp({ token = sessionToken }: { token?: string } = {}) {
  const app = mountApi(express(), token)

  if (config.production) {
    const dist = path.join(ROOT, 'dist')
    if (!existsSync(path.join(dist, 'index.html'))) throw new Error('Run `npm run build` first (or use `npm run dev`).')
    const page = injectToken(readFileSync(path.join(dist, 'index.html'), 'utf8'), token)
    app.use(express.static(dist, { index: false, maxAge: '1h' }))
    app.get('*', (_req, res) => res.type('html').set('Cache-Control', 'no-store').send(page))
  } else {
    const { createServer } = await import('vite')
    const tokenInPage: Plugin = { name: 'mzn-token', transformIndexHtml: (html) => injectToken(html, token) }
    const vite = await createServer({
      configFile: path.join(ROOT, 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
      plugins: [tokenInPage],
    })
    app.use(vite.middlewares)
  }
  return app
}

const entryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (entryPoint) {
  const app = await createApp()
  app.listen(config.port, config.host, () => {
    console.log(`\n  ● MZN Vagas at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}\n`)
    console.log(`    workspace: ${config.workspaceFolder}\n`)
  })
}
