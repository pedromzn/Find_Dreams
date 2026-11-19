/** `/api/voice`: status, on-demand install (background, progress over SSE), speak a turn, transcribe an answer. */

import express, { Router } from 'express'
import { z } from 'zod'
import { languageSchema } from '../../shared/languages.js'
import { route } from '../errors.js'
import { log } from '../logger.js'
import { broadcast } from '../agent/events.js'
import { installVoice, speak, transcribe, vocabularyHint, voiceStatus } from '../voice/voice.js'
import { readApplication } from '../store/workspace.js'
import { readProfile } from '../store/profile.js'

export const voiceRouter = Router()

voiceRouter.get(
  '/voice',
  route(async (_req, res) => res.json({ data: await voiceStatus() })),
)

voiceRouter.post(
  '/voice/install',
  route(async (_req, res) => {
    const promise = installVoice((step) => broadcast({ type: 'agent', payload: { kind: 'voice_install', step } }))
    promise.catch((error) => {
      log.warn('voice install failed', { error })
      broadcast({ type: 'agent', payload: { kind: 'voice_install', step: 'failed' } })
    })
    res.status(202).json({ data: await voiceStatus() })
  }),
)

voiceRouter.post(
  '/voice/speak',
  route(async (req, res) => {
    const { text, language } = z
      .object({ text: z.string().trim().min(1).max(2000), language: languageSchema })
      .strict()
      .parse(req.body)
    const wav = await speak(text, language)
    res.type('audio/wav').set('Cache-Control', 'no-store').send(wav)
  }),
)

voiceRouter.post(
  '/voice/transcribe',
  express.raw({ type: () => true, limit: '20mb' }),
  route(async (req, res) => {
    const language = languageSchema.parse(req.query.language)
    // the vocabulary comes from the app's own files, not from the page: company, role and the person's stack
    const slug = typeof req.query.application === 'string' ? req.query.application : ''
    const application = slug ? readApplication(slug)?.application : null
    const hint = vocabularyHint({
      company: application?.company,
      role: application?.role,
      stack: readProfile().profile?.stack.map((s) => s.name),
    })
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    res.json({ data: { text: await transcribe(body, language, hint) } })
  }),
)
