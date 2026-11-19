/**
 * The agents the app can start through ACP (Agent Client Protocol). Commands checked against each project's docs and
 * agentclientprotocol.com/overview/agents on 2026-11-19 — they change: `docs/AGENTS-SUPPORT.md` is the place to keep
 * them current, and the `add-agent` dev skill says how to add one.
 *
 * Each agent logs in with its own CLI, once, in a terminal (the app never sees passwords). For Claude, the adapter runs
 * on the person's own Claude Code install and login (subscription or API key, whatever they set up in the CLI); the
 * app never logs in for them. Agents on a subscription plan spend that plan's limits: the screens say so
 * (`usesPlanLimits`). Decided with the maintainer on 2026-11-19 — see docs/AGENTS-SUPPORT.md.
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
  /** the person's own CLI the adapter should run (its install and its login), passed in `executableEnv` */
  executable?: { binary: string; env: string }
  /** tasks and interviews count against the person's plan limits: warn on screen */
  usesPlanLimits?: boolean
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
    name: 'Claude Code',
    detect: 'claude-agent-acp',
    command: 'claude-agent-acp',
    args: [],
    fallback: {
      detect: 'npx',
      command: 'npx',
      args: ['-y', '@agentclientprotocol/claude-agent-acp@0.109.0'],
    },
    install: 'https://docs.anthropic.com/en/docs/claude-code',
    login:
      'Uses your Claude Code login: run `claude` once in a terminal and sign in. Tasks and interviews count against your Claude plan limits.',
    secrets: ['ANTHROPIC_API_KEY'],
    executable: { binary: 'claude', env: 'CLAUDE_CODE_EXECUTABLE' },
    usesPlanLimits: true,
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
  usesPlanLimits: boolean
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

/** Every agent, where it is and what is missing. (Keys are optional now, so `_hasSecret` is kept for the callers.) */
export async function detectAll(_hasSecret: (name: string) => boolean): Promise<DetectedAgent[]> {
  return Promise.all(
    AGENTS.map(async (def) => {
      const found = await detect(def)
      // the person's own CLI must exist when the adapter runs on it (Claude Code)
      const missing = def.executable && !(await which(def.executable.binary)) ? def.executable.binary : null
      return {
        id: def.id,
        name: def.name,
        installed: found.via !== null,
        via: found.via,
        path: found.path,
        install: def.install,
        login: def.login,
        needsSecret: missing,
        usesPlanLimits: Boolean(def.usesPlanLimits),
      }
    }),
  )
}

export const findAgent = (id: string) => AGENTS.find((a) => a.id === id) ?? null

/**
 * The environment an agent runs with: its API keys from the secret store (when set) and, for adapters that run on the
 * person's own CLI, the path of that CLI (so its install and its login are used).
 */
export async function agentEnv(
  def: AgentDefinition,
  secret: (name: string) => string | null,
): Promise<Record<string, string>> {
  const extra: Record<string, string> = {}
  for (const name of def.secrets ?? []) {
    const value = secret(name)
    if (value) extra[name] = value
  }
  if (def.executable) {
    const cli = await which(def.executable.binary)
    if (cli) extra[def.executable.env] = cli
  }
  return extra
}
