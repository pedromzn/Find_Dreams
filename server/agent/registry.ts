/**
 * The agents the app can start through ACP (Agent Client Protocol). Commands checked against each project's docs and
 * agentclientprotocol.com/overview/agents on 2026-11-19 — they change: `docs/AGENTS-SUPPORT.md` is the place to keep
 * them current, and the `add-agent` dev skill says how to add one.
 *
 * Each agent logs in with its own CLI, once, in a terminal (the app never sees passwords). Claude is the exception:
 * the app passes the person's own API key, never a claude.ai subscription login (see docs/AGENTS-SUPPORT.md — offering
 * subscription login inside a third-party product needs Anthropic's approval).
 */

import { which } from './shellPath.js'

export interface AgentDefinition {
  id: string
  name: string
  /** the executable the person installs; `detect` is looked up on the shell PATH */
  detect: string
  /** how to start it in ACP mode, once `detect` is found */
  command: string
  args: string[]
  /** when `detect` is missing but this runner exists, start the npm adapter through it (pinned version) */
  fallback?: { detect: string; command: string; args: string[] }
  install: string
  /** what the person must do once, in a terminal, before the first use */
  login: string
  /** environment variables the app passes from its secret store, if set */
  secrets?: string[]
}

export const AGENTS: AgentDefinition[] = [
  {
    id: 'gemini',
    name: 'Gemini CLI',
    detect: 'gemini',
    command: 'gemini',
    args: ['--acp'],
    install: 'https://geminicli.com/docs/cli/acp-mode/',
    login: 'Run `gemini` once in a terminal and sign in.',
  },
  {
    id: 'codex',
    name: 'Codex',
    detect: 'codex-acp',
    command: 'codex-acp',
    args: [],
    fallback: { detect: 'npx', command: 'npx', args: ['-y', '@agentclientprotocol/codex-acp@2.8.0'] },
    install: 'https://github.com/agentclientprotocol/codex-acp',
    login: 'Run `codex login` once in a terminal (or set an OpenAI API key in the settings).',
    secrets: ['OPENAI_API_KEY'],
  },
  {
    id: 'claude',
    name: 'Claude (your API key)',
    detect: 'claude-agent-acp',
    command: 'claude-agent-acp',
    args: ['--hide-claude-auth'],
    fallback: {
      detect: 'npx',
      command: 'npx',
      args: ['-y', '@agentclientprotocol/claude-agent-acp@0.109.0', '--hide-claude-auth'],
    },
    install: 'https://github.com/agentclientprotocol/claude-agent-acp',
    login: 'Add your Anthropic API key in the settings. Claude subscription login is not offered in this app.',
    secrets: ['ANTHROPIC_API_KEY'],
  },
  {
    id: 'kimi',
    name: 'Kimi Code',
    detect: 'kimi',
    command: 'kimi',
    args: ['acp'],
    install: 'https://github.com/MoonshotAI/kimi-code',
    login: 'Run `kimi` once in a terminal and use /login.',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    detect: 'opencode',
    command: 'opencode',
    args: ['acp'],
    install: 'https://opencode.ai/docs/acp/',
    login: 'Run `opencode auth login` once in a terminal.',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    detect: 'copilot',
    command: 'copilot',
    args: ['--acp', '--stdio'],
    install: 'https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server',
    login: 'Run `copilot` once in a terminal and sign in to GitHub.',
  },
]

export interface DetectedAgent {
  id: string
  name: string
  installed: boolean
  /** how it would be started: the native binary, the npx fallback, or not at all */
  via: 'native' | 'npx' | null
  path: string | null
  install: string
  login: string
  needsSecret: string | null
}

export interface Launch {
  command: string
  args: string[]
}

/** Where each agent is, and how it would start. */
export async function detect(
  def: AgentDefinition,
): Promise<{ via: DetectedAgent['via']; path: string | null; launch: Launch | null }> {
  const native = await which(def.detect)
  if (native) return { via: 'native', path: native, launch: { command: native, args: def.args } }
  if (def.fallback) {
    const runner = await which(def.fallback.detect)
    if (runner) return { via: 'npx', path: runner, launch: { command: runner, args: def.fallback.args } }
  }
  return { via: null, path: null, launch: null }
}

export async function detectAll(hasSecret: (name: string) => boolean): Promise<DetectedAgent[]> {
  return Promise.all(
    AGENTS.map(async (def) => {
      const found = await detect(def)
      const missing = def.id === 'claude' ? ((def.secrets ?? []).find((s) => !hasSecret(s)) ?? null) : null
      return {
        id: def.id,
        name: def.name,
        installed: found.via !== null,
        via: found.via,
        path: found.path,
        install: def.install,
        login: def.login,
        needsSecret: missing,
      }
    }),
  )
}

export const findAgent = (id: string) => AGENTS.find((a) => a.id === id) ?? null
