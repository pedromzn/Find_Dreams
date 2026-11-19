/**
 * Live practice interviews. A session lives in memory while it runs (with its brain), and its transcript is written
 * to `interviews/<date>-<type>[-n]/transcript.json` after every turn — a crash loses nothing said. When it ends, the
 * app creates an `interview-feedback` request for the agent.
 *
 * Latency is measured per turn: in voice, a brain slower than ~4 s per turn breaks the conversation, and the screen
 * suggests Ollama.
 */

import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  interviewerPersonaSchema,
  interviewSessionSchema,
  type InterviewerPersona,
  type InterviewSession,
} from '../../shared/interview.js'
import type { InterviewType } from '../../shared/interviewTypes.js'
import type { Language } from '../../shared/languages.js'
import { HttpError } from '../errors.js'
import { log } from '../logger.js'
import { validSlug, workspacePath, writeFileAtomic } from '../store/workspace.js'
import { createRequest } from '../agent/requests.js'
import { chatMessages, defaultPersona, systemPrompt } from './context.js'
import { openBrain, type BrainChoice, type InterviewBrain } from './brains.js'

interface Live {
  id: string
  slug: string
  folder: string
  persona: InterviewerPersona
  session: InterviewSession
  brain: InterviewBrain
  system: string
  busy: boolean
  lastUsed: number
}

const live = new Map<string, Live>()
const IDLE_MS = 30 * 60_000

export interface TurnResult {
  id: string
  folder: string
  say: string
  intent: 'probe' | 'next_topic' | 'wrap_up' | 'end'
  latencyMs: number
  engine: InterviewBrain['engine']
  personaPrepared: boolean
}

function readPersona(slug: string, id: string | undefined, type: InterviewType, language: Language) {
  if (id) {
    try {
      const file = workspacePath('applications', slug, 'interviewers', `${id}.json`)
      return { persona: interviewerPersonaSchema.parse(JSON.parse(readFileSync(file, 'utf8'))), prepared: true }
    } catch {
      throw new HttpError(422, 'That interviewer persona is missing or has problems.', 'invalid_file')
    }
  }
  return { persona: defaultPersona(type, language), prepared: false }
}

function freeFolder(slug: string, type: InterviewType, day: string): string {
  const base = `${day}-${type}`
  let folder = base
  for (let n = 2; existsSync(workspacePath('applications', slug, 'interviews', folder)); n++) folder = `${base}-${n}`
  return folder
}

function save(s: Live) {
  const session = interviewSessionSchema.parse(s.session)
  writeFileAtomic(
    workspacePath('applications', s.slug, 'interviews', s.folder, 'transcript.json'),
    `${JSON.stringify(session, null, 2)}\n`,
  )
}

/** Closes sessions nobody touched for 30 minutes (their transcripts stay as `abandoned`). */
function sweep(now = Date.now()) {
  for (const s of live.values()) {
    if (now - s.lastUsed > IDLE_MS) {
      s.session.status = 'abandoned'
      save(s)
      s.brain.close()
      live.delete(s.id)
    }
  }
}

async function interviewerTurn(s: Live): Promise<TurnResult> {
  const started = Date.now()
  const reply = await s.brain.reply(s.system, chatMessages(s.session))
  s.session.turns.push({ speaker: 'interviewer', text: reply.say, ts: new Date().toISOString() })
  save(s)
  return {
    id: s.id,
    folder: s.folder,
    say: reply.say,
    intent: reply.intent,
    latencyMs: Date.now() - started,
    engine: s.brain.engine,
    personaPrepared: !s.persona.id.startsWith('default-'),
  }
}

export async function startInterview(
  input: {
    application: string
    interviewType: InterviewType
    persona?: string
    language: Language
    mode: 'text' | 'voice'
    brain: BrainChoice
  },
  open: (choice: BrainChoice) => Promise<InterviewBrain> = openBrain,
): Promise<TurnResult> {
  sweep()
  if (!validSlug(input.application) || !existsSync(workspacePath('applications', input.application))) {
    throw new HttpError(404, 'Application not found.', 'not_found')
  }
  const { persona } = readPersona(input.application, input.persona, input.interviewType, input.language)
  const brain = await open(input.brain)
  const now = new Date()
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const s: Live = {
    id: randomUUID(),
    slug: input.application,
    folder: freeFolder(input.application, input.interviewType, day),
    persona,
    brain,
    system: systemPrompt(input.application, persona, input.language),
    busy: false,
    lastUsed: Date.now(),
    session: {
      application: input.application,
      interviewType: input.interviewType,
      persona: persona.id,
      language: input.language,
      mode: input.mode,
      brain: brain.engine,
      turns: [],
      startedAt: now.toISOString(),
      status: 'in_progress',
    },
  }
  live.set(s.id, s)
  try {
    return await interviewerTurn(s)
  } catch (e) {
    brain.close()
    live.delete(s.id)
    throw new HttpError(502, `The interview brain failed: ${e instanceof Error ? e.message : e}`, 'brain_failed')
  }
}

function get(id: string): Live {
  const s = live.get(id)
  if (!s) throw new HttpError(404, 'This interview is no longer running.', 'not_found')
  return s
}

export async function candidateTurn(id: string, text: string): Promise<TurnResult> {
  const s = get(id)
  if (s.busy) throw new HttpError(409, 'Wait for the interviewer to finish.', 'busy')
  s.busy = true
  s.lastUsed = Date.now()
  try {
    s.session.turns.push({ speaker: 'candidate', text: text.trim(), ts: new Date().toISOString() })
    save(s)
    return await interviewerTurn(s)
  } catch (e) {
    if (e instanceof HttpError) throw e
    log.warn('interview brain failed', { error: e })
    throw new HttpError(502, `The interview brain failed: ${e instanceof Error ? e.message : e}`, 'brain_failed')
  } finally {
    s.busy = false
  }
}

/** Ends the interview, saves it as completed and hands the feedback to the agent (a request). */
export function endInterview(id: string, language: Language) {
  const s = get(id)
  s.session.status = 'completed'
  s.session.endedAt = new Date().toISOString()
  save(s)
  s.brain.close()
  live.delete(id)
  const request = createRequest({
    task: 'interview-feedback',
    application: s.slug,
    file: `interviews/${s.folder}/transcript.json`,
    interviewType: s.session.interviewType,
    language,
  })
  return { folder: s.folder, request }
}

export function closeAllInterviews() {
  for (const s of live.values()) s.brain.close()
  live.clear()
}

/** Tests drive the sessions with a scripted brain. */
export const __test = { live }
