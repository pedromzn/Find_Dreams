import express from 'express'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../shared/zodPortuguese.js'
import { config } from './config.js'
import { mountApi } from './main.js'
import { openDb, setDb } from './store/db.js'

const TOKEN = 'test-token'
let server: Server
let base: string
let port: number

/** A request as the app's own page makes it: right Host (fetch sets it), the token, optionally an Origin. */
function call(route: string, init: RequestInit & { token?: string | null; origin?: string } = {}) {
  const headers = new Headers(init.headers)
  if (init.token !== null) headers.set('X-MZN-Token', init.token ?? TOKEN)
  if (init.origin) headers.set('Origin', init.origin)
  return fetch(`${base}${route}`, { ...init, headers })
}

beforeAll(async () => {
  rmSync(config.workspaceFolder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  cpSync(path.join(config.root, 'test', 'fixtures', 'sample-workspace'), config.workspaceFolder, { recursive: true })
  setDb(openDb(':memory:'))
  const app = mountApi(express(), TOKEN)
  server = await new Promise((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s))
  })
  port = (server.address() as AddressInfo).port
  base = `http://127.0.0.1:${port}/api`
})

afterAll(async () => {
  setDb(null)
  server.closeAllConnections()
  await new Promise((ok) => server.close(ok))
})

describe('API', () => {
  it('health answers in the { data } shape', async () => {
    const answer = await call('/health')
    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ data: { ok: true } })
  })

  it('an unknown route is a 404 with a code', async () => {
    const answer = await call('/nothing-here')
    expect(answer.status).toBe(404)
    expect(await answer.json()).toMatchObject({ code: 'not_found' })
  })

  it('a malformed JSON body is a 400, not a 500', async () => {
    const answer = await call('/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    expect(answer.status).toBe(400)
    expect(await answer.json()).toMatchObject({ code: 'invalid_json' })
  })

  it('lists the applications from the workspace files, flagging broken ones', async () => {
    const folder = path.join(config.workspaceFolder, 'applications', 'broken-one-20261119')
    mkdirSync(folder)
    writeFileSync(path.join(folder, 'application.json'), '{"slug": "broken-one-20261119"}')
    const answer = await call('/applications')
    expect(answer.status).toBe(200)
    const { data } = await answer.json()
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      slug: 'acme-pagamentos-backend-engineer-20261110',
      company: 'Acme Pagamentos',
      status: 'interviewing',
      problems: [],
    })
    expect(data[1]).toMatchObject({ slug: 'broken-one-20261119', company: null })
    expect(data[1].problems.length).toBeGreaterThan(0)
  })
})

describe('the local API lock', () => {
  it('refuses a request without the token', async () => {
    const answer = await call('/health', { token: null })
    expect(answer.status).toBe(401)
    expect(await answer.json()).toMatchObject({ code: 'unauthorized' })
  })

  it('refuses a wrong token (and one of a different length)', async () => {
    expect((await call('/health', { token: 'test-tokeN' })).status).toBe(401)
    expect((await call('/health', { token: 'x' })).status).toBe(401)
  })

  it('refuses another website (cross-origin request)', async () => {
    const answer = await call('/health', { origin: 'https://evil.example' })
    expect(answer.status).toBe(403)
    expect(await answer.json()).toMatchObject({ code: 'forbidden_origin' })
  })

  it('accepts the page itself as Origin, on 127.0.0.1', async () => {
    expect((await call('/health', { origin: `http://127.0.0.1:${port}` })).status).toBe(200)
  })

  it('refuses the same host on another port as Origin', async () => {
    expect((await call('/health', { origin: `http://127.0.0.1:${port + 1}` })).status).toBe(403)
  })

  it('refuses a DNS-rebinding Host, even with the token', async () => {
    // fetch does not let us set Host; a raw HTTP request does
    const { request } = await import('node:http')
    const status = await new Promise<number>((ok, fail) => {
      const r = request(
        {
          host: '127.0.0.1',
          port,
          path: '/api/health',
          headers: { Host: `evil.example:${port}`, 'X-MZN-Token': TOKEN },
        },
        (res) => {
          res.resume()
          ok(res.statusCode ?? 0)
        },
      )
      r.on('error', fail)
      r.end()
    })
    expect(status).toBe(403)
  })
})
