/**
 * Builds the API (`/api`) following the contract in `shared/api.ts`. Every success response is `{ data }`; errors come
 * from `handleError`. The token and the Host/Origin checks are mounted in front of it by `main.ts` — this router
 * assumes the caller is the app's own page.
 */

import { Router } from 'express'
import type { ApplicationSummary, Health } from '../shared/api.js'
import { listIndexed, syncIndex } from './store/applicationIndex.js'
import { readApplications } from './store/workspace.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  const data: Health = { ok: true }
  res.json({ data })
})

/** The board's list: the index (refreshed from the files) plus the files with problems, so they never disappear. */
apiRouter.get('/applications', (_req, res) => {
  syncIndex()
  const problems = new Map(readApplications().map((a) => [a.slug, a.problems]))
  const data: ApplicationSummary[] = listIndexed().map((a) => ({ ...a, problems: problems.get(a.slug) ?? [] }))
  const indexed = new Set(data.map((a) => a.slug))
  for (const [slug, list] of problems) {
    if (!indexed.has(slug) && list.length) data.push({ slug, company: null, role: null, problems: list })
  }
  res.json({ data })
})
