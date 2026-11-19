/**
 * Requests: `requests/<id>.json` in the workspace, plus the short prompt the person pastes into any AI CLI opened in
 * the workspace when no agent is connected (the sibling projects' "copy the prompt" flow). With an agent connected
 * (phase 4), the same request is what the agent receives.
 */

import { readdirSync, readFileSync, rmSync } from 'node:fs'
import {
  newRequestSchema,
  requestSchema,
  TASK_SKILL,
  type AgentRequest,
  type NewRequest,
} from '../../shared/request.js'
import type { Language } from '../../shared/languages.js'
import { slugify } from '../../shared/common.js'
import { validateFile } from '../../shared/workspace.js'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { validSlug, workspacePath, writeFileAtomic } from '../store/workspace.js'

const ID = /^\d{8}-\d{6}-[a-z0-9-]+$/

function stamp(now: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

export function createRequest(input: NewRequest, now = new Date()): AgentRequest {
  const fields = newRequestSchema.parse(input)
  if (fields.application && !validSlug(fields.application)) throw new HttpError(422, 'Invalid application.', 'invalid')
  const base = `${stamp(now)}-${slugify(fields.task)}`
  let id = base
  for (let n = 2; existsRequest(id); n++) id = `${base}-${n}`
  const request = requestSchema.parse({ ...fields, id, status: 'pending', createdAt: now.toISOString() })
  writeFileAtomic(workspacePath('requests', `${id}.json`), `${JSON.stringify(request, null, 2)}\n`)
  return request
}

function existsRequest(id: string) {
  try {
    readFileSync(workspacePath('requests', `${id}.json`))
    return true
  } catch {
    return false
  }
}

export function listRequests(): Array<{ id: string; request: AgentRequest | null; problems: string[] }> {
  let names: string[] = []
  try {
    names = readdirSync(workspacePath('requests')).filter((n) => n.endsWith('.json'))
  } catch {
    return []
  }
  return names
    .sort()
    .reverse()
    .map((name) => {
      const id = name.slice(0, -5)
      const content = readFileSync(workspacePath('requests', name), 'utf8')
      const problems = validateFile(`requests/${name}`, content) ?? ['Not a request file.']
      return { id, request: problems.length ? null : requestSchema.parse(JSON.parse(content)), problems }
    })
}

export function readRequest(id: string): AgentRequest {
  if (!ID.test(id)) throw new HttpError(404, 'Request not found.', 'not_found')
  try {
    return requestSchema.parse(JSON.parse(readFileSync(workspacePath('requests', `${id}.json`), 'utf8')))
  } catch {
    throw new HttpError(404, 'Request not found.', 'not_found')
  }
}

export function deleteRequest(id: string) {
  if (!ID.test(id)) throw new HttpError(404, 'Request not found.', 'not_found')
  rmSync(workspacePath('requests', `${id}.json`), { force: true })
}

export function markDone(id: string) {
  const request = readRequest(id)
  writeFileAtomic(
    workspacePath('requests', `${id}.json`),
    `${JSON.stringify({ ...request, status: 'done' }, null, 2)}\n`,
  )
}

const PROMPT: Record<Language, (r: AgentRequest) => string> = {
  en: (r) =>
    `Read AGENTS.md in this folder, then do the request in requests/${r.id}.json using the skill ` +
    `.claude/skills/${TASK_SKILL[r.task]}/SKILL.md. Validate every file you write with node .mzn/validate.mjs, ` +
    `and set the request's status to "done" at the end.`,
  'pt-BR': (r) =>
    `Leia o AGENTS.md desta pasta e faça o pedido em requests/${r.id}.json usando a skill ` +
    `.claude/skills/${TASK_SKILL[r.task]}/SKILL.md. Valide cada arquivo que escrever com node .mzn/validate.mjs ` +
    `e, no fim, mude o status do pedido para "done".`,
}

/** The prompt to paste, and the folder to open the AI in. */
export function promptFor(request: AgentRequest): { prompt: string; folder: string } {
  return { prompt: PROMPT[request.language](request), folder: config.workspaceFolder }
}
