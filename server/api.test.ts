import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../shared/zodPortuguese.js'
import { apiRouter } from './api.js'
import { handleError } from './errors.js'

let server: Server
let base: string

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api', apiRouter)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route not found.', code: 'not_found' }))
  app.use('/api', handleError)
  server = await new Promise((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s))
  })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})

afterAll(async () => {
  server.closeAllConnections()
  await new Promise((ok) => server.close(ok))
})

describe('API', () => {
  it('health answers in the { data } shape', async () => {
    const answer = await fetch(`${base}/health`)
    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ data: { ok: true } })
  })

  it('an unknown route is a 404 with a code', async () => {
    const answer = await fetch(`${base}/nothing-here`)
    expect(answer.status).toBe(404)
    expect(await answer.json()).toMatchObject({ code: 'not_found' })
  })

  it('a malformed JSON body is a 400, not a 500', async () => {
    const answer = await fetch(`${base}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    expect(answer.status).toBe(400)
    expect(await answer.json()).toMatchObject({ code: 'invalid_json' })
  })
})
