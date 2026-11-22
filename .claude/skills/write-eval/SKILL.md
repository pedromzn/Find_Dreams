---
name: write-eval
description: Use when adding a product eval to Find Dreams — a verifiable check of how the AI behaves (the interviewer, the feedback, the drafts), recorded and/or live.
---

# Write an eval

Evals check **behavior the agent kit promises**, with criteria a program can verify (docs/PLAN.md, section 11). They
live in `scripts/evals.ts`; the data in `evals/` is for **fictional candidates only**.

1. Name the promise and where the kit makes it (e.g. "HR always covers the salary" ← `interviewer/reference/hr_screening.md`).
2. Write the criterion as a pure function returning `{ name, ok, evidence }` — evidence quotes what passed or failed.
   Prefer simple, robust signals (a quote that must be a substring, a keyword family, a count) over fragile parsing.
3. Test it in `scripts/evals.test.ts` with a passing AND a failing example: a check that cannot fail is not a check.
4. Wire it into `interviewChecks` (interviews) or the drafts case in `recordedCases`.
5. Record a real output for it in `evals/recorded/<case>/` when you have one (run the live mode or the app with the
   fictional candidate), so `npm run evals` keeps checking it in CI.
6. Live: `npm run evals -- --live --brain ollama` (or `api`/`acp`) runs the scripted candidates against a real brain.
