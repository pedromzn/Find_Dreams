# Evals

Checks of how the AI behaves, as the agent kit promises (docs/PLAN.md, section 11). **Fictional data only.**

- `candidates/ana-backend/` — the fictional candidate (the same as the test fixtures).
- `jobs/` — fictional job posts.
- `recorded/` — real outputs produced on 2026-11-19 (Claude through ACP as the interview brain; Claude Code for the
  feedback and the drafts) for that candidate: two text interviews with feedback, two voice HR screenings
  (pt-BR, en), and reply drafts for a recruiter message.

```bash
npm run evals                                   # deterministic, on recorded/ (runs in verify and CI)
npm run evals -- --live --brain ollama          # live: scripted candidates against a real brain → output/ (ignored)
```

Criteria today: HR covers the salary and insists after a dodge; the technical interviewer probes after a vague
answer; one question at a time; the interview stays in its language; feedback quotes the transcript; drafts have 2–3
options, invent no experience ("N years of X" must be in the CV) and take salary figures from the profile.
How to add one: `.claude/skills/write-eval/SKILL.md`.
