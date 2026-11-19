---
name: add-interview-type
description: Use when adding a new interview stage to MZN Vagas (e.g. "pair programming", "bar raiser") — the enum, both dictionaries, the agent-kit references, a persona role and an eval.
---

# Add an interview type

1. `shared/interviewTypes.ts`: add the id (snake_case) to `INTERVIEW_TYPES`. TypeScript then points at every place that
   needs it: `web/src/i18n/en.ts` and `pt-BR.ts` (`interviewType`), and the generic persona role in
   `server/interview/context.ts` (`ROLE`).
2. `agent-kit/.claude/skills/prepare-interview/reference/<id>.md`: what it evaluates, typical questions, traps (the
   same three sections as the others, specific — not generic advice).
3. `agent-kit/.claude/skills/interviewer/reference/<id>.md`: how the interviewer conducts it, 3–6 numbered steps.
4. Bump `agent-kit/VERSION` (the app updates the kit in every workspace, keeping edits).
5. Run `npm run vagas:schemas` (the enum is in the JSON Schemas) and keep `test/fixtures/sample-workspace` valid.
6. Add a scripted candidate for it in `scripts/evals.ts` (`SCRIPTS`) if the stage has a checkable behavior, and a
   criterion (see the `write-eval` skill).
7. `npm run verify`.
