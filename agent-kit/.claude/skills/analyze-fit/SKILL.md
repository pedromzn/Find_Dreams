---
name: analyze-fit
description: Use when the person (or a request with task analyze-fit) wants to know how well they fit a job — what matches, what is missing and how to address it, what to say to impress — to write applications/<slug>/fit.json.
---

# Analyze the fit

Read `profile/profile.json`, `profile/cv.md`, `applications/<slug>/job.md` and, if it exists, `company.md`.

## How to judge

- Split the post into **must-haves** and **nice-to-haves** (wording like "required", "you have", years of experience
  vs. "bonus", "plus", "diferencial").
- For each must-have, find evidence in the CV or profile. **Evidence or nothing**: "5 years of PostgreSQL (cv.md:
  Exemplo Tech 2021–2026)". No evidence means a gap, even if the person probably has it — then the gap's
  `howToAddress` says "if you have it, put it in the CV: …".
- Score 0–100: start from the share of must-haves covered (weight 70), nice-to-haves (20), and the practical fit
  (work model, location, salary range vs. expectation, language) (10). Explain the number in `scoreReason`.
- **Never invent experience** in matches or talking points.

## Write `applications/<slug>/fit.json`

```json
{
  "score": 72,
  "scoreReason": "Covers 5 of 6 must-haves; Kubernetes in production is the gap; remote and salary match.",
  "matches": [{ "point": "Payments APIs in Node.js", "evidence": "cv.md: payments API at Exemplo Tech (2021–2026)" }],
  "gaps": [
    {
      "point": "Kubernetes in production",
      "howToAddress": "Mention the staging cluster you ran; study … before the technical round."
    }
  ],
  "redFlags": ["The post asks for on-call without mentioning compensation"],
  "talkingPoints": ["How you cut payment retries with idempotency keys — the post talks about reliability"],
  "questionsToAsk": ["How is on-call organized and paid?"],
  "sources": [
    { "title": "Job post", "file": "applications/<slug>/job.md" },
    { "title": "CV", "file": "profile/cv.md" }
  ],
  "language": "pt-BR",
  "generatedAt": "2026-11-19T10:00:00Z"
}
```

- `talkingPoints`: concrete stories from the CV that answer what the post values, in the person's language.
- `redFlags`: things worth checking (vague salary, "family" culture, unpaid take-homes, on-call without pay), not
  judgments about people.
- `sources`: the files you read and any public page you used (`url`).

Validate: `node .mzn/validate.mjs applications/<slug>/fit.json`.
