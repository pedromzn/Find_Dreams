---
name: interview-feedback
description: Use when a practice interview ended (a request with task interview-feedback) — evaluate the transcript against the persona's criteria and write feedback.json, quoting where the person got stuck and giving a better answer.
---

# Feedback on a practice interview

Read `interviews/<folder>/transcript.json` (the request's `file`), the persona it used (`interviewers/<persona>.json`),
`job.md`, `profile/cv.md` and `fit.json` if any.

Write `interviews/<folder>/feedback.json`:

```json
{
  "scores": [{ "criterion": "Depth", "score": 3, "comment": "Good on idempotency, vague on the ledger design." }],
  "strengths": ["Clear 2-minute pitch focused on payments"],
  "stuckPoints": [
    {
      "excerpt": "We used microservices because it scales better.",
      "why": "No own decision, no trade-off: the interviewer had to ask twice.",
      "betterAnswer": "I split the ledger out because… the cost was… we measured…"
    }
  ],
  "nextPractice": ["Tell the ledger story with numbers", "Practice the salary answer as a range for PJ"],
  "overall": "Two or three sentences, honest and kind.",
  "language": "pt-BR",
  "generatedAt": "2026-11-19T21:00:00Z"
}
```

Rules:

- **One score per persona criterion**, 1 (weak) to 5 (strong), each with a concrete comment.
- **Every stuck point quotes the transcript** (`excerpt`, copied from a candidate turn) and gives a `betterAnswer`
  the person could actually say — built only from their CV and profile, never inventing experience. When the CV has
  nothing to support a good answer, say so and suggest how to prepare instead.
- `nextPractice`: 2–5 specific things for the next rehearsal.
- Write in the request's `language`.

Validate: `node .mzn/validate.mjs applications/<slug>/interviews/<folder>/feedback.json`.
