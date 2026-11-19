---
name: add-agent
description: Use when adding support for a new ACP agent (a CLI that speaks the Agent Client Protocol) to MZN Vagas — registry entry, docs and a real connection test.
---

# Add an agent

1. Check the agent's current ACP command in its own docs and on agentclientprotocol.com/overview/agents. Do not trust
   memory: commands and package names change (several were renamed in 2026).
2. Add an `AgentDefinition` to `server/agent/registry.ts`: `detect` (the binary on the shell PATH), `command`/`args`,
   an optional pinned `npx` `fallback`, `install` (a URL) and `login` (what the person runs once in a terminal). If it
   takes an API key, add the variable to `secrets` and to `KNOWN_SECRETS` in `server/secrets.ts`.
3. Add a row to `docs/AGENTS-SUPPORT.md`, including any terms-of-service caveat about subscription logins.
4. Run it for real: `npm run dev`, "Your AI" → Test, then an "Analyze the fit" request on a fictional application.
   Record the date and the outcome in the "Verified" section.
5. `npm run verify`.
