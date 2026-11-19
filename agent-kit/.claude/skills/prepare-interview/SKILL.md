---
name: prepare-interview
description: Use when the person (or a request with task prepare-interview) wants to rehearse an interview stage — HR, technical, client, hiring manager, live coding, system design, panel, language, final, case, async video — to build the interviewer persona (interviewers/<id>.json) the practice interview uses.
---

# Prepare an interview

Read `application.json` (stages already done), `job.md`, `company.md` (if any), `fit.json` (if any), the debriefs of
earlier real stages (`debriefs/*.json` — **what the person already heard matters**: an HR screening that asked about
English means the technical round may be partly in English) and the reference for the stage:
`.claude/skills/prepare-interview/reference/<interviewType>.md`.

## The persona

Write `applications/<slug>/interviewers/<id>.json` (`id` = the file name, e.g. `technical-backend-lead`):

```json
{
  "id": "technical-backend-lead",
  "interviewType": "technical",
  "role": "Backend tech lead of the payments team",
  "tone": "Calm, curious, pushes for concrete examples",
  "values": ["Ownership of production", "Clear trade-offs"],
  "likelyQuestions": ["Walk me through the payments API you built…", "How do you guarantee idempotency on retries?"],
  "criteria": [{ "name": "Depth", "description": "Goes beyond buzzwords with own decisions and numbers" }],
  "basis": [
    { "trait": "Payments domain questions", "source": "job_post", "reference": "job.md: 'payments team'" },
    { "trait": "Asks about English", "source": "user_report", "reference": "debriefs/2026-11-14-hr_screening.json" }
  ],
  "language": "en"
}
```

Rules:

- **Built from the job, the company's public pages and what the person told you — never from a real person.** No
  names unless the person typed the interviewer's name; never look anyone up. Every trait goes in `basis` with its
  source (`job_post`, `company_site`, `public_source`, `user_report`).
- 8–15 `likelyQuestions`, specific to this job (not generic lists), in the interview's language.
- 3–6 `criteria`: what a real interviewer for this stage would score (the reference lists them).
- `language`: the interview's language (`request.interviewType` and `request.details` may say "in English").
- Then add a short "what to prepare" summary in your reply to the person (3–5 bullets).

Validate: `node .mzn/validate.mjs applications/<slug>/interviewers/<id>.json`.
