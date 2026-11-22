# Architecture

How Find Dreams is built, and the decisions taken along the way that `docs/PLAN.md` left open. The plan is the source of
truth for _what_; this file records _how_ and _why_, phase by phase.

## Shape

One npm package (no monorepo), the same shape as the sibling projects (`../learning-anything`, `../Photos_use`):

- `server/` — Express. `createApp()` mounts the API on `/api` and, in dev, Vite as middleware on the same port (one
  process, one port); in production it serves `dist/`. The desktop main process will import the same `createApp()`.
- `shared/` — zod contracts shared by server, web and scripts.
- `web/` — React 19, react-router 7, zustand, Tailwind 4, Phosphor icons, bundled fonts (works offline).

## Decisions

### Phase 0 — skeleton

- **Dev port 3060** (decided with the maintainer), following 3040/3050 of the sibling projects. The desktop app will
  listen on a random free port instead.
- **Workspace in `config.workspaceFolder`**, from `MZN_WORKSPACE` or `./workspace` by default (git-ignored). Tests
  point it at a fresh temp folder (`test/setup.ts`), so they never read a developer's real data.
- **`.gitignore` anchors `/profile/` and `/applications/` at the root**, so a future source folder with the same name
  (`server/applications/`) is not silently ignored. Their real home is inside `workspace/`, which is ignored as a
  whole; the CI privacy test (phase 1) is the second line of defense.
- **Dependency versions copied from the sibling projects** (React 19.1, Vite 6.4, Tailwind 4.1, zod 4, Express 4.22,
  Vitest 4), so the three projects move together under Dependabot. Electron, the ACP library, electron-builder and
  electron-updater are pinned in their phases, after checking their current docs.
- **`npm run verify` = format check + typecheck + tests + build.** The siblings run validation of content instead of
  the build; here the build is the cheapest proof that the web app still compiles, until there is content to validate
  (`vagas:validate` joins in phase 1).
- **Theme tokens** follow the names in the plan (`bg`, `surface`, `surface-2`, `border`, `text`, `muted`, `accent`,
  `accent-hover`, `danger`…) plus two the contrast check asked for: `accent-text` (the brand red is too dark to be
  _text_ on black at AA, so red text uses a lighter red) and `faint`. `danger` is pink, not red, so an error never
  reads as the brand. `web/src/style/contrast.test.ts` checks every pair against WCAG AA from the real CSS.
- **The interface language is stored in `localStorage`**, as in the siblings. Known issue for phase 7: Electron serves
  the app on a random port each launch and `localStorage` is per origin, so the choice would be lost. In the desktop
  phase, the preference moves to the server settings (SQLite) or the port becomes stable per install.
- **The repository URL** used in docs and templates is `https://github.com/pedromzn/mzn-vagas` (assumed from the
  package name; the remote does not exist yet).

### Phase 1 — domain and storage

- **The workspace map and the validator live in `shared/workspace.ts`** (pure, no disk), so the dev CLI
  (`vagas:validate`), the server and the future packaged `mzn-vagas validate` share one implementation. PLAN.md
  section 2 was corrected to say so: the `vagas:*` npm scripts are for developers; the person's AI validates through
  the app.
- **Schemas are `.strict()`**, like the siblings: an unknown field is an error, so the AI's typos (`compnay`) do not
  pass silently. Contacts accept only `name` and `role` — an e-mail or phone there is a validation error, not just a
  convention.
- **Path cross-checks**: the content must agree with where it lives (`slug` = folder, persona `id` = file name,
  session `interviewType` = folder suffix, debrief `date` = file name).
- **`job.md` and `company.md` carry a minimal front matter** (`key: value` lines between `---`, no YAML library):
  `source`, `capturedAt`, `url?` for the job; `researchedAt` for the company, whose body must cite at least one link.
- **SQLite holds the index, the status history and preferences** at `<workspace>/.mzn/state.sqlite`. The index keeps
  no salary, contact or note. The files are the truth: `syncIndex` records status changes made by editing the file,
  keeps the last good row while a file is broken, and drops rows whose folder is gone.
- **Writes are atomic** (temp file + rename); the workspace walk never follows symbolic links.
- **The API token reaches the page in a `<meta>` tag**, not through the Electron preload the plan mentions: the
  server injects it into the `index.html` it serves (Vite plugin in dev, string replace in production). Same origin,
  so no other site can read it; the Host check (on every request, page included) stops DNS rebinding. It works the same
  in the browser and in the Electron window, so there is one mechanism instead of two. The desktop main process only
  passes the token (`MZN_API_TOKEN` or `createApp({ token })`).
- **`HOST=0.0.0.0` is effectively unsupported**: the Host check accepts only loopback names. Opening the API to the
  network is not a use case for a CV and salary database.
- **Future SSE/WebSocket routes** (agent streaming, phase 4) cannot send custom headers from `EventSource`; they will
  take the token in the query string, on the same Host/Origin check.
- **The logger** (`server/logger.ts`, from infra-mercado) masks e-mails, CPF/CNPJ, phone numbers and money amounts,
  and drops whole fields with sensitive names (`cv`, `salary*`, `messages`, `body`, `text`, `turns`, `notes`…). It is
  silent under Vitest unless `LOG_LEVEL` is set.
- **The privacy gate** (`npm run privacy:check`, in `verify` and CI) fails on tracked workspace folders, personal
  documents (`.pdf`, `.doc(x)`, `.odt`…), databases and `.env` files. Fictional fixtures live in `test/fixtures/`
  and `evals/`.
- **The validator CLI speaks English** (zod's English locale), since its reader is a developer or their AI; the app's
  forms still get Portuguese messages in pt-BR.

### Phase 2 — tracker without AI

- **Job capture** (`server/jobs/capture.ts`): one adapter per public format — Greenhouse and Lever JSON APIs, Gupy's
  `__NEXT_DATA__` (undocumented: when it changes, the generic adapter still reads the page), Ashby's public board — and
  a generic adapter (Readability + Turndown). Endpoints checked live on 2026-11-19. LinkedIn and Glassdoor are refused
  before any request (`login_required`); the UI switches to "paste the text". Fetches are bounded (15 s, 3 MB,
  http(s) only) and send a generic User-Agent, nothing about the person. Tests use recorded fixtures and a fake
  fetcher: no network in CI.
- **linkedom instead of jsdom** for Readability: jsdom 31 requires Node ≥ 22.22 (our floor is 22.13) and is heavy;
  linkedom does not execute scripts. Readability documents only jsdom, so a quirk is possible (relative links).
- **CV import** (`server/jobs/cvImport.ts`): the type is detected by magic bytes; DOCX through mammoth → HTML →
  Turndown (mammoth's Markdown output is deprecated), PDF through `pdfjs-dist` legacy build (unpdf needs Node ≥ 24).
  The file is sent as the raw request body (no multipart library) and **never stored**: only the reviewed `cv.md`.
  No PDF/DOCX fixture can live in git (privacy gate), so the PDF test writes a tiny PDF by hand; DOCX is covered only
  by type detection.
- **Edits are field patches**: `PATCH /api/applications/:slug` merges only the keys the client sent (a schema default
  must never wipe what the AI wrote). Deleting moves the folder to `.mzn/trash/`.
- **Language in SQLite too**: the app mirrors the picked language to `/api/settings`, so the desktop app (random port,
  per-origin `localStorage`) keeps it. This closes the phase 0 known issue.
- **Dates**: a bare `YYYY-MM-DD` is read as local noon when formatted (as UTC midnight it showed the previous day in
  Brazil).

### Phase 3 — agent kit and the copy-the-prompt fallback

- **`agent-kit/`** holds the person's AI manual (`AGENTS.md`), `CLAUDE.md`, a Cursor rule and the skills. The app
  installs it into the workspace on start; `.mzn/agent-kit.json` records the hash of each file as written, so an
  update replaces untouched files and leaves edited ones alone, writing the new version as `<file>.new` and listing a
  conflict the person resolves on the "Your AI" screen (keep mine / use the new one).
- **Validation for the person's AI without npm**: the app writes `.mzn/validate.mjs` (plain Node, no dependency) and
  `.mzn/session.json` (this run's port and token). The script asks the running app to validate (`POST /api/validate`),
  so the rules live in one place. Both sides go through `realpath` (a workspace behind a symlink — iCloud, `/var` on
  macOS — broke the relative paths). Files the app does not validate (pasted messages) print `[skipped]`, not a
  problem. The token in `session.json` protects against websites, not local processes, which can read the workspace
  anyway. PLAN section 8 offered a packaged CLI; this works the same in dev and in the desktop app, with nothing to
  put on the PATH.
- **Requests** (`requests/<id>.json`, schema in `shared/request.ts`) are written for every task, with or without an
  agent. Without one, the dialog shows the folder and a one-line prompt to paste into any AI CLI.
- **Reply drafts** live next to the message: `messages/<name>.drafts.md`, 2 or 3 `## ` options (validated).
- **Live screens**: `fs.watch` (recursive) on the workspace, debounced per file, validates each changed file and sends
  it over SSE (`/api/events`, the only route that takes the token in the query string — `EventSource` cannot send
  headers). The board and the application screen reload on their own while the AI writes.
- **Checked end to end** on 2026-11-19 with Claude Code 2.1 in a scratch workspace: analyze-fit, reply-recruiter,
  track-application (from a pasted e-mail) and research-company all produced valid files and marked their requests
  done. Codex could not be tried on this machine (its account answered 402 `deactivated_workspace`).
- **Job fetches refuse private addresses** (loopback, RFC 1918, link-local, CGNAT, metadata, ULA) and follow
  redirects by hand, re-checking each hop (flagged by a security review). Known gap: the DNS answer is not pinned
  between the check and the connection.

### Phase 4 — ACP

- **The official SDK, version 2.x** (`@agentclientprotocol/sdk@2.8.0`, stable v1 entry point). Its API changed in
  2.0 (2026-10): `client().onRequest(...).onNotification(...).connect(ndJsonStream(stdin, stdout))` — the older
  `ClientSideConnection` no longer exists. Several adapter packages were renamed under `@agentclientprotocol/`.
- **`AgentSession`** (`server/agent/acp.ts`) spawns the agent with the workspace as `cwd` (created first: a missing
  `cwd` makes spawn fail with a misleading ENOENT for the binary), answers fs requests only inside the workspace and
  never in `.mzn/`, and turns session updates into simple events. Three races found by the tests and fixed:
  a permission answered synchronously was lost (now registered before it is announced); "connection closed" hid the
  exit message with the agent's stderr (now preferred); the last chunks before a prompt's response were dropped (the
  SDK does not await notification handlers; a short drain follows each prompt).
- **Runs** (`server/agent/runner.ts`) stream over the same SSE bus; permissions become buttons on the page; the
  outcome (not the text) is stored in `agent_runs` (migration v2). The app also marks the request done when the turn
  ends.
- **Shell PATH**: the login shell is asked once (`$SHELL -ilc`), merged with ours and well-known folders.
- **npx fallback** for the Codex and Claude adapters, pinned to exact versions, shown as "available via npx" (not
  "installed").
- **Claude: API key only** (`--hide-claude-auth`), keys behind a `SecretStore` (memory/env in dev; the desktop app
  plugs in the OS keychain). This is open decision 2 of the plan; the safe default was taken and documented in
  `docs/AGENTS-SUPPORT.md`.
- **Verified with a real adapter**: `claude-agent-acp@0.109.0` ran an analyze-fit request end to end through
  `AgentSession` (session 16 s, result 76 s). The plan's "two different agents" criterion could not be met on this
  machine: Codex's account answers 402, and Gemini, Kimi, OpenCode and Copilot are not installed. The fake agent covers
  the protocol paths.
- **Headless screenshots**: Chrome's `--screenshot` stalls while an SSE stream is open; the dev screenshots go through
  the DevTools protocol instead (not part of the app).

### Phase 5 — text simulator

- **Preparation is agent work, conversation is brain work.** `prepare-interview` writes the persona
  (`interviewers/<id>.json`, every trait with its `basis`); the live turns come from an `InterviewBrain`
  (`server/interview/brains.ts`): `ollama` (copied from learning-anything's Feynman brain: JSON through Ollama's
  `format`), `acp` (one agent session kept open for the whole interview, tools refused, JSON answers parsed out of the
  text) or `api` (the person's key; Anthropic `claude-haiku-5-5` by default, or any OpenAI-compatible endpoint whose
  model the person sets). "Automatic" picks Ollama if running, then the agent, then the API key.
- **The conduct is the `interviewer` skill**, read from the workspace copy first, so the person's edits apply. The
  brain gets it plus the persona, the job, the company research and the CV, all inside `<data>` tags.
- **Without a prepared persona** the app builds a generic one for the stage from `prepare-interview/reference/` (the
  screen offers to prepare a real one with the AI).
- **Transcripts are saved after every turn**; a second interview on the same day gets `<date>-<type>-2` (the
  workspace map accepts the suffix). Ending creates an `interview-feedback` request.
- **Debriefs** are a guided form (the plan says "guided conversation"): the person's account is saved as-is, and the
  analysis and next-stage adjustments are the AI's (`debrief` skill), which may also update the next persona.
- **Checked on 2026-11-19** with the real Claude ACP adapter as the brain: an HR screening (the recruiter insisted
  politely on the salary range when the candidate dodged) and a technical round (it dug one level deeper after a vague
  answer and noticed an evasive one), 4–6 s per turn. Claude Code then wrote both feedbacks: one score per criterion,
  stuck points quoting the transcript, better answers built only from the CV (with `[fill in]` gaps where the CV had
  no facts).

### Phase 6 — voice

- **Copied** the Whisper and Kokoro workers and `PythonProcess` from learning-anything. Installed on demand into the
  app's data folder (`MZN_DATA`, `.data/` in dev; the desktop app passes `userData`) with uv or a system Python;
  Kokoro model files sha256-checked (same pins as the sibling).
- **No ffmpeg**: the page records 16 kHz mono 16-bit WAV itself (ScriptProcessor: deprecated but universal in
  Chromium, and needs no worklet file a strict CSP could block), with silence detection calibrated on the room.
- **Whisper gets the job's vocabulary** as `initial_prompt` (company, role, the person's stack, CLT/PJ/backend…),
  built server-side from the files. It fixed "backend" (heard as "baquê" without it); a synthesized "CLT" is still
  misheard — real speech should do better, not verified.
- **The interviewer speaks sentence by sentence**: the next sentence is synthesized while the current one plays, so
  the first words come in about a second instead of 4–9 s for a long turn.
- **Checked** with a microphone-free run: Kokoro synthesized the candidate's answers, Whisper heard them, the ACP brain
  answered and Kokoro spoke, for a full HR screening in pt-BR and in English. Brain 4–6 s per turn with the ACP
  agent, which is why the screen suggests Ollama for voice (not installed on the machine used). The browser
  microphone path is not exercised by any automated check.

### Phase 7 — desktop

- **Electron 45.4.1** (Node 24.22.3 inside): `node:sqlite` works without a flag, checked in Electron's Node and in the
  packaged app — no better-sqlite3 needed. **electron-builder 26.18.1** and **electron-updater 6.8.12** (the 27/7
  alphas disable implicit publishing and require signed update manifests).
- **The same server**: `desktop/main.ts` sets the environment (workspace, `MZN_DATA = userData`, agent kit and voice
  scripts from the extra resources, a per-launch token), then imports the bundled server and listens on 127.0.0.1 with
  a random port. esbuild compiles main + server into one ESM file and the preload into CommonJS (a sandboxed preload
  cannot be ESM); dependencies stay external and electron-builder packs only the server's runtime ones (the web app's
  libraries moved to devDependencies — Vite compiles them into `dist/`).
- **Hardening**: contextIsolation, no nodeIntegration, sandbox, no webview; CSP set on every response (production
  only; Vite dev needs inline scripts); external links open in the system browser, other navigation is blocked; only
  the microphone permission, only for the app's origin; one instance per user.
- **Workspace**: `~/Documents/Find Dreams` by default, changeable in Settings (the app relaunches). The choice lives in
  `userData/desktop.json`. `MZN_USER_DATA` gives a separate profile for development and smoke tests.
- **Keys** in the OS keychain through `safeStorage`; saving refuses (instead of falling back to plain text) when the
  keychain is unavailable.
- **Updates**: Windows (NSIS) and Linux (AppImage) update by themselves; unsigned macOS apps cannot, so the app only
  tells the person and links the release (the mac `zip` target is still built for when signing arrives).
- **Release**: on a `v*` tag, CI verifies, then builds on macOS, Windows and Linux runners and publishes to a draft
  release with the `latest*.yml` files. Unsigned until the certificates exist (open decision 3).
- **Checked locally (macOS x64)**: `electron .` and the packaged, unsigned `.app` (349 MB) both start, install the
  agent kit from the extra resources, serve the API with the token, store in SQLite, detect agents through the shell
  PATH; the window has the CSP, no Node and the preload bridge. **Not checked**: the Windows and Linux installers and
  the update path end to end — they need the GitHub repository and a tag.

### Phase 8 — evals, docs and launch

- **Evals** (`scripts/evals.ts`, data in `evals/`): verifiable criteria for the promises of the agent kit — HR covers
  the salary (asking, or confirming a figure the candidate offered) and insists after a dodge; the technical
  interviewer probes after a vague answer; one question at a time; the interview stays in its language; feedback quotes
  the transcript; drafts have 2–3 options, invent no experience and take salary figures from the profile. Each
  criterion is tested passing and failing. The recorded cases are real outputs from 2026-11-19 for the fictional
  candidate; `npm run evals` runs them in `verify` and CI. `--live` runs scripted candidates against a real brain
  (and `.github/workflows/evals-live.yml` does it on demand with an API key from the repository secrets).
- **Every interview type** now has a preparation reference and an interviewer conduct (agent kit version 3).
- **Docs**: README (download links, a GIF tour and screenshots of the fictional candidate), `docs/PRIVACY.md`,
  `docs/AGENTS-SUPPORT.md`, and the dev skills `add-interview-type`, `add-agent` and `write-eval`.
- **Not done here**: the README's "someone from outside installs and practices following only the README" criterion
  needs a published release and a person; the download links point to a repository that does not exist yet.

### After phase 8 — Claude through the person's Claude Code login

- Decided with the maintainer (2026-11-19): the Claude agent runs on the person's own Claude Code install and login
  (subscription or API key), not only on an API key. The registry passes `CLAUDE_CODE_EXECUTABLE` (the `claude` found
  on the shell PATH) and no longer `--hide-claude-auth`; an API key in the app is optional. Agents marked
  `usesPlanLimits` show a warning on "Your AI", in the run dialog and in the practice setup: tasks and interviews spend
  the person's plan limits. Rationale and the terms caveat in `docs/AGENTS-SUPPORT.md`; PLAN.md section 15 updated.

### v2 — feature parity with job-search suites, and a new interface (2026-11-21)

Plan: [`docs/PLAN-V2.md`](PLAN-V2.md). Benchmarked against aiapply.co's public pages.

- **New workspace files**, all validated in `shared/workspace.ts`: `profile/resume.json` (+ `resume.<language>.json`)
  and `applications/<slug>/resume.json` (`shared/resume.ts`), `cover-letter.md` and `salary.md` (front matter),
  `follow-ups/<date>.md` (2–3 drafts, like reply drafts) and `discoveries/<date>.json` (`shared/discovery.ts`). The
  app writes back only what the person changes on screen: a résumé's `template`, the letter's text, a discovered
  job's `status`.
- **New tasks and skills** (agent kit version 4): `tailor-resume` (base, translation or tailored — never inventing),
  `cover-letter`, `follow-up`, `salary-research`, `find-jobs` (public job pages only; never LinkedIn).
- **The ATS check is local and deterministic** (`shared/ats.ts`): the post's terms (a vocabulary plus the shapes of
  technical names) weighted by section — requirements ×2, nice-to-have ×0.5 — matched as whole words without accents,
  plus five structure checks. No AI, so it is instant, repeatable and free; the AI is what fixes the gaps.
- **Not copied on purpose**: auto-apply and live interview coaching (PLAN.md §14). The "apply kit" on each
  application gathers what to send and records that the person applied.
- **Interface**: graphite surfaces in steps (dark) and a light theme (Settings: system/dark/light, mirrored in the
  server's preferences like the language); each stage has its own color (`--st-*`), used across the funnel, cards and
  badges; one type family (Instrument Sans; Fraunces removed); a labelled, collapsible sidebar mounted once as a
  layout route; full width up to 1600 px. `contrast.test.ts` checks both themes and the stage colors against WCAG AA.
- **Résumés and letters render as paper** in three templates (modern, Harvard, classic); "Export PDF" is the print
  dialog with print CSS that leaves only the sheet — no PDF library, works in the browser and in Electron.
- **`GET /api/overview`** feeds the home, résumés, letters, interviews and tools screens from one read of the
  workspace (fine at personal scale: tens of applications).

### Renamed to Find Dreams (2026-11-21)

- Every visible name (interface, window, installers, docs, the agent kit) is now **Find Dreams**; the default workspace
  is `~/Documents/Find Dreams`, but an existing `~/Documents/MZN Vagas` keeps being used (`desktop/settings.ts`), so
  the rename never hides anyone's data.
- Internal identifiers stay `mzn-vagas` for now: npm package, `appId`, the workspace's `.mzn/` folder, `MZN_*`
  variables, the `X-MZN-Token` header and `localStorage` keys. Renaming those would break existing workspaces and
  settings for no visible gain; the GitHub repository name is decided when it is created.
