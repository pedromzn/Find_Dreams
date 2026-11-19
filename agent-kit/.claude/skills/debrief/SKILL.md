---
name: debrief
description: Use after a REAL interview (a request with task debrief, or the person saying "I just had the interview with…") — analyze the person's account in debriefs/<date>-<type>.json and adjust the preparation of the next stages.
---

# Debrief a real interview

The app saved the person's account in `applications/<slug>/debriefs/<date>-<type>.json` (the request's `file`):
`account`, `questionsAsked`, `selfAssessment`. If the person tells you more in the chat, add it to the account in
their words.

1. Read it with `application.json`, `job.md`, `fit.json`, the persona for that stage (if any) and earlier debriefs.
2. Fill `analysis`: what went well, where they hesitated, what the questions reveal about what the company values
   (2–4 short paragraphs, kind and honest).
3. Fill `adjustments`: concrete changes for the **next** stages ("the technical round will probably go into the
   ledger: prepare…", "they asked about English twice: rehearse a language interview"). If a persona for the next
   stage exists, update its `likelyQuestions` and `basis` (`source: "user_report"`, `reference: "debriefs/<file>"`).
4. Update `application.json` if the account says so (a new stage, a next step, the result) — set `updatedAt`.
5. Never record details about the interviewers as people beyond their role.

Validate every file you changed with `node .mzn/validate.mjs`.
