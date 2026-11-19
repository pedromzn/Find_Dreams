# How to contribute

Thanks for wanting to help. This project accepts code, new interview types, support for new AI agents, improvements to
the AI instructions and bug reports.

## Before you start

- Node 24 LTS (22.13 or newer works).
- `git clone`, then `npm install` and `npm run dev` (http://localhost:3060). Your dev data goes to `./workspace`, which
  git ignores.
- Read [`AGENTS.md`](AGENTS.md) (where things live, the rules) and [`docs/PLAN.md`](docs/PLAN.md) (the plan).

## Verification (run before opening the pull request)

```bash
npm run verify       # format check, types, tests and build
npm run format       # Prettier, if the format check complained
```

## Conventions

- Strict TypeScript, ESM. Prettier decides the formatting.
- Code, comments and docs in **English**. Interface text lives in `web/src/i18n/` (English is the base, `pt-BR.ts` the
  translation).
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`…).
- The app **does not call any AI API on its own**: the person's agent (via ACP), their Ollama or their own API key do.
  No telemetry.
- The server listens only on `127.0.0.1`, and the API requires the session token. Do not change that without
  discussion.
- **No personal data in the repository**: no real CV, salary, recruiter message, PDF or DOCX — not even in test
  fixtures. Use fictional candidates and companies.
- **No profiling of people**: no LinkedIn scraping, no profiles of real recruiters or interviewers.
- Tests: change the code, change the tests. A new test for every bug fixed.

## Pull request

- One change per PR, with a description of the problem and how you tested it.
- Visual change: a screenshot helps — with fictional data only.

## Maintainers

- `main` is protected: the CI checks must pass. Merge with **squash**, with a title that says what changed.
- Label pull requests (`feature`, `bug`, `docs`, `interview`, `agent`, `dependencies`): the release notes are grouped
  by label.

## License

By contributing, you agree that your work is published under the project's MIT license.
