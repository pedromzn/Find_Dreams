/** `/api/agents` (which agents exist, which is chosen, a connection test) and `/api/runs` (requests run by the agent). */

import { Router } from 'express'
import { z } from 'zod'
import { route } from '../errors.js'
import { HttpError } from '../errors.js'
import { KNOWN_SECRETS, secrets } from '../secrets.js'
import { setPreference } from '../store/settings.js'
import { AGENTS, detectAll } from '../agent/registry.js'
import { answerPermission, cancelRun, getRun, listRuns, selectedAgent, startRun, testAgent } from '../agent/runner.js'

export const agentsRouter = Router()

agentsRouter.get(
  '/agents',
  route(async (_req, res) => {
    res.json({ data: { agents: await detectAll(secrets.has), selected: selectedAgent() } })
  }),
)

agentsRouter.put(
  '/agents/selected',
  route((req, res) => {
    const { id } = z.object({ id: z.string().nullable() }).strict().parse(req.body)
    if (id !== null && !AGENTS.some((a) => a.id === id)) throw new HttpError(404, 'Unknown agent.', 'not_found')
    setPreference('agent', id)
    res.json({ data: { selected: id } })
  }),
)

agentsRouter.post(
  '/agents/:id/test',
  route(async (req, res) => res.json({ data: await testAgent(String(req.params.id)) })),
)

/** API keys: set or clear; the page only ever learns whether one is set. */
agentsRouter.get(
  '/secrets',
  route((_req, res) => res.json({ data: Object.fromEntries(KNOWN_SECRETS.map((n) => [n, secrets.has(n)])) })),
)

agentsRouter.put(
  '/secrets/:name',
  route((req, res) => {
    const name = z.enum(KNOWN_SECRETS).parse(req.params.name)
    const { value } = z
      .object({ value: z.string().trim().max(500).nullable() })
      .strict()
      .parse(req.body)
    secrets.set(name, value || null)
    res.json({ data: { [name]: secrets.has(name) } })
  }),
)

agentsRouter.get(
  '/runs',
  route((_req, res) => res.json({ data: listRuns() })),
)

agentsRouter.post(
  '/runs',
  route(async (req, res) => {
    const { requestId, agent } = z
      .object({ requestId: z.string(), agent: z.string().optional() })
      .strict()
      .parse(req.body)
    res.status(202).json({ data: await startRun(requestId, agent) })
  }),
)

agentsRouter.get(
  '/runs/:id',
  route((req, res) => res.json({ data: getRun(String(req.params.id)) })),
)

agentsRouter.post(
  '/runs/:id/cancel',
  route(async (req, res) => res.json({ data: await cancelRun(String(req.params.id)) })),
)

agentsRouter.post(
  '/runs/:id/permission',
  route((req, res) => {
    const { permissionId, optionId } = z
      .object({ permissionId: z.string(), optionId: z.string().nullable() })
      .strict()
      .parse(req.body)
    answerPermission(String(req.params.id), permissionId, optionId)
    res.json({ data: { ok: true } })
  }),
)
