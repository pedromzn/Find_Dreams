/**
 * The interview brains: what produces the interviewer's next turn, fast. Three engines behind one interface:
 *
 * - `ollama`: a local model (copied from learning-anything's Feynman brain: JSON answers through Ollama's `format`,
 *   checked by zod). Fastest for voice, nothing leaves the machine.
 * - `acp`: the person's agent, through a session kept open for the whole interview, told to answer only JSON and use
 *   no tools (permissions are refused automatically).
 * - `api`: the person's own API key (Anthropic, or any OpenAI-compatible endpoint). The key comes from the secret
 *   store; the model is a setting.
 *
 * Preparing the interview (persona, questions) is NOT done here: that is agent work, done before.
 */

import { z } from 'zod'
import { brainReplySchema, type BrainReply } from '../../shared/interview.js'
import { HttpError } from '../errors.js'
import { secrets } from '../secrets.js'
import { getPreference } from '../store/settings.js'
import { AgentSession } from '../agent/acp.js'
import { detect, findAgent } from '../agent/registry.js'
import { selectedAgent } from '../agent/runner.js'
import { childEnv } from '../agent/shellPath.js'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export interface InterviewBrain {
  readonly engine: 'ollama' | 'acp' | 'api'
  reply(system: string, messages: ChatMessage[]): Promise<BrainReply>
  close(): void
}

/** The JSON object inside a model's text (some wrap it in prose or a code fence). */
export function parseReply(text: string): BrainReply {
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start < 0 || end < start) {
    // a model that ignored the format but said something useful: keep the conversation going
    if (clean) return { say: clean.slice(0, 2000), intent: 'probe', notes: '' }
    throw new Error('The brain gave an empty answer.')
  }
  return brainReplySchema.parse(JSON.parse(clean.slice(start, end + 1)))
}

// ── Ollama ───────────────────────────────────────────────────────────────────

export const PREFERRED_MODELS = ['qwen3:8b', 'qwen3:4b', 'llama3.1:8b', 'gemma3:4b'] as const

export function ollamaUrl(value: string | undefined = process.env.OLLAMA_HOST): string {
  let v = (value ?? '').trim() || '127.0.0.1:11434'
  if (!/^https?:\/\//.test(v)) v = `http://${v}`
  return v.replace(/\/+$/, '').replace('//0.0.0.0', '//127.0.0.1')
}

const stripTag = (name: string) => name.replace(/:latest$/, '')

export function chooseModel(installed: readonly string[], request: string | null | undefined): string | null {
  const lookup = (m: string) => installed.find((i) => i === m || stripTag(i) === stripTag(m)) ?? null
  if (request?.trim()) return lookup(request.trim())
  for (const m of PREFERRED_MODELS) if (lookup(m)) return lookup(m)
  return installed.find((n) => !/embed|bge|minilm/i.test(n)) ?? null
}

const thinksFirst = (model: string) => /^(qwen3|deepseek-r1|magistral|gpt-oss)/i.test(model)

export async function ollamaState(
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; models: string[]; model: string | null }> {
  try {
    const r = await fetcher(`${ollamaUrl()}/api/tags`, { signal: AbortSignal.timeout(2500) })
    const j = (await r.json()) as { models?: Array<{ name?: string }> }
    const models = (j.models ?? []).flatMap((m) => (m.name ? [m.name] : []))
    return { ok: r.ok, models, model: r.ok ? chooseModel(models, getPreference('ollamaModel')) : null }
  } catch {
    return { ok: false, models: [], model: null }
  }
}

export function ollamaBrain(model: string, fetcher: typeof fetch = fetch): InterviewBrain {
  return {
    engine: 'ollama',
    async reply(system, messages) {
      const r = await fetcher(`${ollamaUrl()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...messages],
          stream: false,
          format: z.toJSONSchema(brainReplySchema, { io: 'input', unrepresentable: 'any' }),
          keep_alive: '30m',
          options: { temperature: 0.6, num_ctx: 16384 },
          ...(thinksFirst(model) ? { think: false } : {}),
        }),
        signal: AbortSignal.timeout(120_000),
      })
      const j = (await r.json().catch(() => null)) as { message?: { content?: string }; error?: string } | null
      if (!r.ok || !j?.message?.content) throw new Error(j?.error ?? `Ollama answered ${r.status}.`)
      return parseReply(j.message.content)
    },
    close() {},
  }
}

// ── API key ──────────────────────────────────────────────────────────────────

export type ApiProvider = 'anthropic' | 'openai'

/** Defaults; both are settings. The Anthropic one is the fast Claude model current on 2026-11-19. */
export const DEFAULT_API_MODEL: Record<ApiProvider, string> = { anthropic: 'claude-haiku-5-5', openai: '' }

export function apiBrain(provider: ApiProvider, model: string, fetcher: typeof fetch = fetch): InterviewBrain {
  const key = secrets.get(provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY')
  if (!key) throw new HttpError(409, 'Add your API key in "Your AI" first.', 'agent_needs_key')
  if (!model) throw new HttpError(409, 'Choose the model in the settings first.', 'invalid')
  return {
    engine: 'api',
    async reply(system, messages) {
      if (provider === 'anthropic') {
        const r = await fetcher('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 600, system, messages }),
          signal: AbortSignal.timeout(60_000),
        })
        const j = (await r.json().catch(() => null)) as {
          content?: Array<{ type: string; text?: string }>
          error?: { message?: string }
        } | null
        if (!r.ok) throw new Error(j?.error?.message ?? `The API answered ${r.status}.`)
        return parseReply((j?.content ?? []).map((c) => c.text ?? '').join(''))
      }
      const base = (getPreference('openaiBaseUrl') || 'https://api.openai.com/v1').replace(/\/+$/, '')
      const r = await fetcher(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...messages],
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(60_000),
      })
      const j = (await r.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>
        error?: { message?: string }
      } | null
      if (!r.ok) throw new Error(j?.error?.message ?? `The API answered ${r.status}.`)
      return parseReply(j?.choices?.[0]?.message?.content ?? '')
    },
    close() {},
  }
}

// ── ACP agent ────────────────────────────────────────────────────────────────

/**
 * The agent as interviewer: one ACP session for the whole interview. The first prompt carries the whole context; each
 * next prompt carries only the candidate's answer (the agent keeps the conversation). Tools are refused.
 */
export async function acpBrain(agentId = selectedAgent()): Promise<InterviewBrain> {
  const def = agentId ? findAgent(agentId) : null
  if (!def) throw new HttpError(409, 'Choose an agent in "Your AI" first.', 'agent_missing')
  const found = await detect(def)
  if (!found.launch) throw new HttpError(409, `${def.name} is not installed.`, 'agent_missing')
  const extra: Record<string, string> = {}
  for (const name of def.secrets ?? []) {
    const v = secrets.get(name)
    if (v) extra[name] = v
  }
  let text = ''
  const session = new AgentSession(
    found.launch,
    await childEnv(extra),
    (e) => e.kind === 'text' && (text += e.text),
    'reject',
  )
  await session.start()
  let primed = false
  return {
    engine: 'acp',
    async reply(system, messages) {
      text = ''
      const last = messages.at(-1)?.content ?? ''
      const prompt = primed
        ? `The candidate says:\n<data>${last}</data>\nReply with only the JSON object.`
        : `${system}\n\nThe conversation so far:\n${messages.map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'CANDIDATE'}: ${m.content}`).join('\n')}\n\nReply with only the JSON object for your next turn.`
      primed = true
      await session.prompt(prompt)
      return parseReply(text)
    },
    close: () => session.close(),
  }
}

// ── choosing ─────────────────────────────────────────────────────────────────

export type BrainChoice = 'auto' | 'ollama' | 'acp' | 'api'

/** The brain for a new interview: the requested one, or (auto) Ollama if running, else the agent, else an API key. */
export async function openBrain(choice: BrainChoice): Promise<InterviewBrain> {
  const provider = (getPreference('apiProvider') as ApiProvider | null) ?? 'anthropic'
  const apiModel = getPreference('apiModel') || DEFAULT_API_MODEL[provider]
  if (choice === 'ollama' || choice === 'auto') {
    const state = await ollamaState()
    if (state.model) return ollamaBrain(state.model)
    if (choice === 'ollama') throw new HttpError(409, 'Ollama is not running, or has no chat model.', 'brain_missing')
  }
  if (choice === 'acp' || (choice === 'auto' && selectedAgent())) return acpBrain()
  if (choice === 'api' || choice === 'auto') return apiBrain(provider, apiModel)
  throw new HttpError(409, 'No interview brain available.', 'brain_missing')
}
