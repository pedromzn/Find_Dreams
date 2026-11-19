/**
 * Builds the API (`/api`) following the contract in `shared/api.ts`. Every success response is `{ data }`; errors come
 * from `handleError` (mounted by whoever uses this router, in `main.ts`).
 */

import { Router } from 'express'
import type { Health } from '../shared/api.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  const data: Health = { ok: true }
  res.json({ data })
})
