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
