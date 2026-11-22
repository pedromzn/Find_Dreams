# Agents supported

Find Dreams does not call any AI on its own: it starts **your** agent through
[ACP (Agent Client Protocol)](https://agentclientprotocol.com) with your workspace folder as the working directory,
or hands you a one-line prompt to paste into any AI you open yourself. Commands checked on 2026-11-19; they change, so
this file and `server/agent/registry.ts` are updated together.

| Agent              | Install                                                                                         | Started as                                                  | Sign-in (once, in a terminal)                      |
| ------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| Gemini CLI         | `npm i -g @google/gemini-cli`                                                                   | `gemini --acp`                                              | run `gemini` and sign in                           |
| Codex              | `npm i -g @agentclientprotocol/codex-acp` (or nothing: the app falls back to `npx`)             | `codex-acp` / `npx -y @agentclientprotocol/codex-acp@2.8.0` | `codex login`, or an OpenAI API key in the app     |
| Claude Code        | Claude Code, plus `npm i -g @agentclientprotocol/claude-agent-acp` (or nothing: `npx` fallback) | `claude-agent-acp`, on your own `claude`                    | run `claude` and sign in (subscription or API key) |
| Kimi Code          | `npm i -g @moonshot-ai/kimi-code` or `brew install kimi-code` (the Python kimi-cli is archived) | `kimi acp`                                                  | run `kimi` and use `/login`                        |
| OpenCode           | see opencode.ai                                                                                 | `opencode acp`                                              | `opencode auth login`                              |
| GitHub Copilot CLI | `npm i -g @github/copilot` (public preview)                                                     | `copilot --acp --stdio`                                     | run `copilot` and sign in to GitHub                |
| Ollama (interview) | ollama.com                                                                                      | not an ACP agent: the fast **interview brain** only         | none (local)                                       |

The app finds these on your **shell's PATH**: a desktop app on macOS/Linux does not inherit it, so the app asks your
login shell once (`server/agent/shellPath.ts`).

## Your own CLI, your own account

Every agent runs **your** CLI with **your** login: Gemini, Kimi, OpenCode and Copilot natively; Codex and Claude
through their ACP adapters, pointed at your own `codex` (`CODEX_PATH`) and `claude` (`CLAUDE_CODE_EXECUTABLE`). The app
never logs in for you. On a plan (ChatGPT, Claude, Google, Kimi, Copilot), every task and practice interview spends
that plan's limits, and the app says so; OpenCode is not flagged because it may run a local model.

## Claude: your Claude Code login

The app starts the official Claude ACP adapter on **your own Claude Code install and login**
(`CLAUDE_CODE_EXECUTABLE` points it at the `claude` on your PATH): sign in once with `claude` in a terminal —
subscription or API key, whatever you use there — and the app never logs in for you. An Anthropic API key in the
app is optional.

**It spends your plan's limits.** Every task and every practice interview run through Claude counts against your
Claude plan, like using Claude Code yourself; the app says so on "Your AI", when you run a task and when you start an
interview with your agent as the engine. For long voice practice, a local Ollama model costs nothing.

Find Dreams is free and open source and does not resell or charge for access to Claude. Anthropic's terms for the
Claude Agent SDK restrict third-party products from offering claude.ai login or subscription limits without approval;
the maintainer chose to allow it here (2026-11-19) because the app is free, runs the person's own CLI and login, and
is explicit about the usage. If Anthropic objects, switching back is one line (`--hide-claude-auth` in
`server/agent/registry.ts`). Check each provider's terms for your own use.

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
