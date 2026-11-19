/** `/api/jobs/capture` (a link → the job post) and `/api/profile/cv/import` (a PDF/DOCX → Markdown, nothing kept). */

import express, { Router } from 'express'
import { z } from 'zod'
import { route } from '../errors.js'
import { captureJob } from '../jobs/capture.js'
import { importCv } from '../jobs/cvImport.js'

export const jobsRouter = Router()

jobsRouter.post(
  '/capture',
  route(async (req, res) => {
    const { url } = z
      .object({ url: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(req.body)
    res.json({ data: await captureJob(url) })
  }),
)

export const cvImportRouter = Router()

cvImportRouter.post(
  '/',
  express.raw({ type: () => true, limit: '10mb' }),
  route(async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    res.json({ data: { markdown: await importCv(body) } })
  }),
)
