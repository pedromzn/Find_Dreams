/** `/api/validate`, `/api/agent-kit`, `/api/requests` and `/api/events`: what the person's AI needs from the app. */

import { Router } from 'express'
import { z } from 'zod'
import { languageSchema } from '../../shared/languages.js'
import { route } from '../errors.js'
import { installKit, kitStatus, resolveConflict } from '../agent/kit.js'
import { createRequest, deleteRequest, listRequests, promptFor, readRequest } from '../agent/requests.js'
import { subscribe } from '../agent/events.js'
import { syncIndex } from '../store/applicationIndex.js'
import { checkFile, checkWorkspace, type FileReport } from '../store/workspace.js'

export const agentRouter = Router()

/** The validator behind `.mzn/validate.mjs`: the AI's way to check a file with the real schemas. */
agentRouter.post(
  '/validate',
  route((req, res) => {
    const body = z
      .union([
        z.object({ all: z.literal(true) }).strict(),
        z.object({ files: z.array(z.string().max(500)).min(1).max(200) }).strict(),
      ])
      .parse(req.body)
    const data: Array<FileReport & { skipped?: boolean }> =
      'all' in body
        ? checkWorkspace()
        : body.files.map((file) => checkFile(file) ?? { file, problems: [], skipped: true })
    syncIndex()
    res.json({ data })
  }),
)

agentRouter.get(
  '/agent-kit',
  route((_req, res) => res.json({ data: kitStatus() })),
)

agentRouter.post(
  '/agent-kit/install',
  route((_req, res) => res.json({ data: installKit() })),
)

agentRouter.post(
  '/agent-kit/resolve',
  route((req, res) => {
    const { file, choice } = z
      .object({ file: z.string().max(300), choice: z.enum(['replace', 'keep']) })
      .strict()
      .parse(req.body)
    res.json({ data: resolveConflict(file, choice) })
  }),
)

agentRouter.get(
  '/requests',
  route((_req, res) => res.json({ data: listRequests() })),
)

agentRouter.post(
  '/requests',
  route((req, res) => {
    const request = createRequest(req.body)
    res.status(201).json({ data: { request, ...promptFor(request) } })
  }),
)

agentRouter.get(
  '/requests/:id/prompt',
  route((req, res) => {
    const request = readRequest(String(req.params.id))
    const language = languageSchema.catch(request.language).parse(req.query.language)
    res.json({ data: { request, ...promptFor({ ...request, language }) } })
  }),
)

agentRouter.delete(
  '/requests/:id',
  route((req, res) => {
    deleteRequest(String(req.params.id))
    res.json({ data: { ok: true } })
  }),
)

agentRouter.get('/events', (_req, res) => subscribe(res))
