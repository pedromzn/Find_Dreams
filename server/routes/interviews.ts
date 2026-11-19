/** `/api/interviews` (practice interviews, live), `/api/brain` (the conversation engine) and debriefs of real ones. */

import { Router } from 'express'
import { z } from 'zod'
import { debriefSchema } from '../../shared/interview.js'
import { interviewTypeSchema } from '../../shared/interviewTypes.js'
import { languageSchema } from '../../shared/languages.js'
import { route } from '../errors.js'
import { HttpError } from '../errors.js'
import { secrets } from '../secrets.js'
import { getPreference, setPreference } from '../store/settings.js'
import { validSlug, workspacePath, writeFileAtomic } from '../store/workspace.js'
import { createRequest, promptFor } from '../agent/requests.js'
import { selectedAgent } from '../agent/runner.js'
import { DEFAULT_API_MODEL, ollamaState, type ApiProvider } from '../interview/brains.js'
import { candidateTurn, endInterview, startInterview } from '../interview/sessions.js'
import { existsSync } from 'node:fs'

export const interviewsRouter = Router()

const brainChoice = z.enum(['auto', 'ollama', 'acp', 'api'])

interviewsRouter.post(
  '/interviews',
  route(async (req, res) => {
    const body = z
      .object({
        application: z.string(),
        interviewType: interviewTypeSchema,
        persona: z.string().optional(),
        language: languageSchema,
        mode: z.enum(['text', 'voice']).default('text'),
        brain: brainChoice.default('auto'),
      })
      .strict()
      .parse(req.body)
    res.status(201).json({ data: await startInterview(body) })
  }),
)

interviewsRouter.post(
  '/interviews/:id/turns',
  route(async (req, res) => {
    const { text } = z
      .object({ text: z.string().trim().min(1).max(8000) })
      .strict()
      .parse(req.body)
    res.json({ data: await candidateTurn(String(req.params.id), text) })
  }),
)

interviewsRouter.post(
  '/interviews/:id/end',
  route((req, res) => {
    const { language } = z.object({ language: languageSchema }).strict().parse(req.body)
    const { folder, request } = endInterview(String(req.params.id), language)
    res.json({ data: { interviewFolder: folder, request, ...promptFor(request) } })
  }),
)

/** The conversation engine: which is chosen, and what is available. */
interviewsRouter.get(
  '/brain',
  route(async (_req, res) => {
    const ollama = await ollamaState()
    const provider = (getPreference('apiProvider') as ApiProvider | null) ?? 'anthropic'
    res.json({
      data: {
        choice: getPreference('brain') ?? 'auto',
        ollama,
        agent: selectedAgent(),
        api: {
          provider,
          model: getPreference('apiModel') || DEFAULT_API_MODEL[provider],
          baseUrl: getPreference('openaiBaseUrl') ?? '',
          hasKey: secrets.has(provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'),
        },
      },
    })
  }),
)

interviewsRouter.put(
  '/brain',
  route((req, res) => {
    const body = z
      .object({
        choice: brainChoice.optional(),
        ollamaModel: z.string().max(100).nullable().optional(),
        apiProvider: z.enum(['anthropic', 'openai']).optional(),
        apiModel: z.string().max(100).nullable().optional(),
        openaiBaseUrl: z
          .url({ protocol: /^https?$/ })
          .nullable()
          .optional(),
      })
      .strict()
      .parse(req.body)
    if (body.choice) setPreference('brain', body.choice)
    if (body.ollamaModel !== undefined) setPreference('ollamaModel', body.ollamaModel || null)
    if (body.apiProvider) setPreference('apiProvider', body.apiProvider)
    if (body.apiModel !== undefined) setPreference('apiModel', body.apiModel || null)
    if (body.openaiBaseUrl !== undefined) setPreference('openaiBaseUrl', body.openaiBaseUrl || null)
    res.json({ data: { ok: true } })
  }),
)

/** A real interview's debrief: the person's account is saved as-is, and the analysis is handed to the agent. */
interviewsRouter.post(
  '/applications/:slug/debriefs',
  route((req, res) => {
    const slug = String(req.params.slug)
    if (!validSlug(slug) || !existsSync(workspacePath('applications', slug))) {
      throw new HttpError(404, 'Application not found.', 'not_found')
    }
    const debrief = debriefSchema.parse({ ...req.body, analysis: '', adjustments: [], outcome: 'pending' })
    let name = `${debrief.date}-${debrief.interviewType}`
    for (let n = 2; existsSync(workspacePath('applications', slug, 'debriefs', `${name}.json`)); n++) {
      name = `${debrief.date}-${debrief.interviewType}-${n}`
    }
    writeFileAtomic(
      workspacePath('applications', slug, 'debriefs', `${name}.json`),
      `${JSON.stringify(debrief, null, 2)}\n`,
    )
    const request = createRequest({
      task: 'debrief',
      application: slug,
      file: `debriefs/${name}.json`,
      interviewType: debrief.interviewType,
      language: debrief.language,
    })
    res.status(201).json({ data: { name, request, ...promptFor(request) } })
  }),
)
