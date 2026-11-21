---
name: follow-up
description: Use when the person (or a request with task follow-up) wants to follow up on an application — after applying, after an interview, or after silence — 2 or 3 drafts in applications/<slug>/follow-ups/<date>.md. Never sends anything.
---

# Draft a follow-up

Read `application.json` (status, stages, dates, contacts), the last debrief and messages if any, and `fit.json`.

## When, and what

- **After applying, no answer for 7+ days**: short, restate the fit in one line, ask whether the process is moving.
- **After an interview (24 h)**: thank, recall one concrete moment of the conversation (from the debrief), add one
  thing you wish you had said, confirm interest.
- **After silence post-interview (5+ business days)**: polite check on next steps and timeline.
- **After a rejection**: thank, ask for feedback, keep the door open.

The request's `details` may say which; otherwise infer from the status and dates.

## The drafts

2 or 3 options under `## ` headings (e.g. `## Short`, `## With a detail from the interview`, `## Asking for
feedback`). Each is a complete message, 60–150 words, in the request's language. Address the contact by first name if
`contacts` has one; otherwise a neutral greeting. Anything you do not know is `[fill in: …]`.

**Never send anything.** Never include the person's phone, e-mail or documents.

## Save

`applications/<slug>/follow-ups/<yyyy-mm-dd>.md` (today; add `-2` if it exists).

Validate: `node .mzn/validate.mjs applications/<slug>/follow-ups/<file>`.
