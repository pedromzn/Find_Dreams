# Architecture

How MZN Vagas is built, and the decisions taken along the way that `docs/PLAN.md` left open. The plan is the source of
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
