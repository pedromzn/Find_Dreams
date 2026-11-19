# Agents supported

MZN Vagas does not call any AI on its own: it starts **your** agent through
[ACP (Agent Client Protocol)](https://agentclientprotocol.com) with your workspace folder as the working directory,
or hands you a one-line prompt to paste into any AI you open yourself. Commands checked on 2026-11-19; they change, so
this file and `server/agent/registry.ts` are updated together.

| Agent              | Install                                                                                         | Started as                                                  | Sign-in (once, in a terminal)                      |
| ------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| Gemini CLI         | `npm i -g @google/gemini-cli`                                                                   | `gemini --acp`                                              | run `gemini` and sign in                           |
| Codex              | `npm i -g @agentclientprotocol/codex-acp` (or nothing: the app falls back to `npx`)             | `codex-acp` / `npx -y @agentclientprotocol/codex-acp@2.8.0` | `codex login`, or an OpenAI API key in the app     |
| Claude             | `npm i -g @agentclientprotocol/claude-agent-acp` (or nothing: `npx` fallback)                   | `claude-agent-acp --hide-claude-auth`                       | **your Anthropic API key**, in the app (see below) |
| Kimi Code          | `npm i -g @moonshot-ai/kimi-code` or `brew install kimi-code` (the Python kimi-cli is archived) | `kimi acp`                                                  | run `kimi` and use `/login`                        |
| OpenCode           | see opencode.ai                                                                                 | `opencode acp`                                              | `opencode auth login`                              |
| GitHub Copilot CLI | `npm i -g @github/copilot` (public preview)                                                     | `copilot --acp --stdio`                                     | run `copilot` and sign in to GitHub                |
| Ollama (interview) | ollama.com                                                                                      | not an ACP agent: the fast **interview brain** only         | none (local)                                       |

The app finds these on your **shell's PATH**: a desktop app on macOS/Linux does not inherit it, so the app asks your
login shell once (`server/agent/shellPath.ts`).

## Claude: API key only

Anthropic's terms do not allow third-party products to offer claude.ai login or subscription limits without prior
approval, and the Claude ACP adapter is built on the Claude Agent SDK. So the app starts the adapter with
`--hide-claude-auth` (it refuses subscription billing) and passes **your own Anthropic API key** (kept in the operating
system keychain in the desktop app). If you use Claude Code with a subscription, you can still use it the other way:
open Claude Code yourself in the workspace folder and paste the prompt the app gives you. Whether the app may offer
subscription sign-in is an open decision (docs/PLAN.md, section 15) that depends on Anthropic.

Check each provider's terms before promising "use your subscription" anywhere.

## What the agent can do in your workspace

- It runs with the workspace as its folder and follows `AGENTS.md` and the skills there.
- File reads and writes that go through the app are limited to the workspace and never touch `.mzn/`.
- Every permission the agent asks for (run a command, write a file) appears as buttons in the app; nothing is
  approved silently.
- The app stores the outcome of each run (agent, status, times, error) — not the agent's text or tool output.

## Verified

- The ACP client is tested against a fake agent that speaks the real protocol (`test/fixtures/fake-acp-agent.mjs`):
  streaming, tool calls, permissions (allowed and refused), file writes confined to the workspace, crashes and
  cancellation.
- 2026-11-19, on a developer machine: the real `@agentclientprotocol/claude-agent-acp@0.109.0` ran an analyze-fit
  request end to end through the app's client (session in 16 s, result in 76 s, valid `fit.json`, request marked
  done). Codex could not be tried (account error on that machine). Gemini, Kimi, OpenCode and Copilot are listed from
  their docs and not yet run end to end.

## Adding an agent

Follow `.claude/skills/add-agent/SKILL.md`: an entry in `server/agent/registry.ts`, a row here, and a run of the
connection test.
