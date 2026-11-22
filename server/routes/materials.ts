/**
 * The v2 screens' routes: the overview (home, résumés, letters, interviews, tools), the résumés, the ATS check, the
 * cover letter the person edits, and the job searches the AI ran.
 */

import { Router } from 'express'
import { z } from 'zod'
import { atsReport } from '../../shared/ats.js'
import { DISCOVERY_STATUSES } from '../../shared/discovery.js'
import { LANGUAGES } from '../../shared/languages.js'
import { RESUME_TEMPLATES, resumeChecks, resumeText } from '../../shared/resume.js'
import { LETTER_TONES, readFrontMatter } from '../../shared/workspace.js'
import { route, HttpError } from '../errors.js'
import {
  applicationDetail,
  listDiscoveries,
  listResumes,
  overview,
  saveLetter,
  saveResume,
  setDiscoveryStatus,
  setResumeTemplate,
} from '../store/applications.js'
import { readFileSync } from 'node:fs'
import { workspacePath } from '../store/workspace.js'

export const materialsRouter = Router()

materialsRouter.get(
  '/overview',
  route((_req, res) => res.json({ data: overview() })),
)

materialsRouter.get(
  '/resumes',
  route((_req, res) => res.json({ data: listResumes() })),
)

/** Only these files: the base résumé, its translations, and a tailored one inside an application. */
const RESUME_FILE = /^(profile\/resume(\.(en|pt-BR))?\.json|applications\/[a-z0-9]+(-[a-z0-9]+)*\/resume\.json)$/

materialsRouter.put(
  '/resumes',
  route((req, res) => {
    const body = z
      .object({ file: z.string().regex(RESUME_FILE), resume: z.record(z.string(), z.unknown()) })
      .strict()
      .parse(req.body)
    saveResume(body.file, body.resume)
    res.json({ data: { ok: true } })
  }),
)

materialsRouter.put(
  '/resumes/template',
  route((req, res) => {
    const body = z
      .object({ file: z.string().regex(RESUME_FILE), template: z.enum(RESUME_TEMPLATES) })
      .strict()
      .parse(req.body)
    setResumeTemplate(body.file, body.template)
    res.json({ data: { ok: true } })
  }),
)

/**
 * The ATS check of an application: the tailored résumé against the job post, or the CV when there is no tailored
 * résumé yet (`basis` says which).
 */
materialsRouter.get(
  '/applications/:slug/ats',
  route((req, res) => {
    const d = applicationDetail(String(req.params.slug))
    if (!d.job) throw new HttpError(409, 'This application has no job post.', 'no_job')
    const job = readFrontMatter(d.job.content)?.body ?? d.job.content
    if (d.resume) {
      res.json({ data: { basis: 'resume', report: atsReport(job, resumeText(d.resume), resumeChecks(d.resume)) } })
      return
    }
    let cv: string | null = null
    try {
      cv = readFileSync(workspacePath('profile', 'cv.md'), 'utf8')
    } catch {
      /* no CV yet */
    }
    res.json({ data: cv ? { basis: 'cv', report: atsReport(job, cv) } : { basis: 'none', report: null } })
  }),
)

materialsRouter.put(
  '/applications/:slug/letter',
  route((req, res) => {
    const body = z
      .object({ body: z.string().trim().min(1).max(20_000), tone: z.enum(LETTER_TONES), language: z.enum(LANGUAGES) })
      .strict()
      .parse(req.body)
    saveLetter(String(req.params.slug), body.body, body.tone, body.language)
    res.json({ data: { ok: true } })
  }),
)

materialsRouter.get(
  '/discoveries',
  route((_req, res) => res.json({ data: listDiscoveries() })),
)

materialsRouter.patch(
  '/discoveries/:name/:index',
  route((req, res) => {
    const { status } = z
      .object({ status: z.enum(DISCOVERY_STATUSES) })
      .strict()
      .parse(req.body)
    setDiscoveryStatus(String(req.params.name), Number(req.params.index), status)
    res.json({ data: { ok: true } })
  }),
)
