/** `/api/applications`: the board, the detail screen, the forms and the pasted messages. */

import { Router } from 'express'
import { z } from 'zod'
import type { ApplicationSummary } from '../../shared/api.js'
import { route } from '../errors.js'
import { listIndexed, syncIndex } from '../store/applicationIndex.js'
import {
  applicationDetail,
  createApplication,
  metrics,
  saveMessage,
  trashApplication,
  updateApplication,
} from '../store/applications.js'
import { readApplications } from '../store/workspace.js'

export const applicationsRouter = Router()

/** The board's list: the index (refreshed from the files) plus the files with problems, so they never disappear. */
applicationsRouter.get(
  '/',
  route((_req, res) => {
    syncIndex()
    const problems = new Map(readApplications().map((a) => [a.slug, a.problems]))
    const data: ApplicationSummary[] = listIndexed().map((a) => ({ ...a, problems: problems.get(a.slug) ?? [] }))
    const indexed = new Set(data.map((a) => a.slug))
    for (const [slug, list] of problems) {
      if (!indexed.has(slug) && list.length) data.push({ slug, company: null, role: null, problems: list })
    }
    res.json({ data })
  }),
)

applicationsRouter.post(
  '/',
  route((req, res) => {
    const application = createApplication(req.body)
    syncIndex()
    res.status(201).json({ data: application })
  }),
)

applicationsRouter.get(
  '/:slug',
  route((req, res) => {
    syncIndex()
    res.json({ data: applicationDetail(String(req.params.slug)) })
  }),
)

applicationsRouter.patch(
  '/:slug',
  route((req, res) => {
    const application = updateApplication(String(req.params.slug), req.body)
    syncIndex()
    res.json({ data: application })
  }),
)

applicationsRouter.delete(
  '/:slug',
  route((req, res) => {
    trashApplication(String(req.params.slug))
    syncIndex()
    res.json({ data: { ok: true } })
  }),
)

const messageSchema = z.object({ text: z.string().trim().min(1).max(50_000) }).strict()

applicationsRouter.post(
  '/:slug/messages',
  route((req, res) => {
    const { text } = messageSchema.parse(req.body)
    res.status(201).json({ data: { name: saveMessage(String(req.params.slug), text) } })
  }),
)

export const metricsRouter = Router()
metricsRouter.get(
  '/',
  route((_req, res) => res.json({ data: metrics() })),
)
