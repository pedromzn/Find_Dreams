/**
 * Builds the API (`/api`) following the contract in `shared/api.ts`. Every success response is `{ data }`; errors come
 * from `handleError`. The token and the Host/Origin checks are mounted in front of it by `main.ts` — this router
 * assumes the caller is the app's own page.
 */

import { Router } from 'express'
import type { Health } from '../shared/api.js'
import { agentRouter } from './routes/agent.js'
import { agentsRouter } from './routes/agents.js'
import { interviewsRouter } from './routes/interviews.js'
import { voiceRouter } from './routes/voice.js'
import { applicationsRouter, metricsRouter } from './routes/applications.js'
import { cvImportRouter, jobsRouter } from './routes/jobs.js'
import { profileRouter, settingsRouter } from './routes/profile.js'
import { materialsRouter } from './routes/materials.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  const data: Health = { ok: true }
  res.json({ data })
})

apiRouter.use('/applications', applicationsRouter)
apiRouter.use('/metrics', metricsRouter)
apiRouter.use('/profile/cv/import', cvImportRouter)
apiRouter.use('/profile', profileRouter)
apiRouter.use('/jobs', jobsRouter)
apiRouter.use('/settings', settingsRouter)
apiRouter.use('/', materialsRouter)
apiRouter.use('/', agentRouter)
apiRouter.use('/', agentsRouter)
apiRouter.use('/', interviewsRouter)
apiRouter.use('/', voiceRouter)
