---
name: track-application
description: Use when the person wants to add or update a job application from a link, a pasted job post or a pasted e-mail ("add this job", "I got an e-mail from Acme", "move Acme to interviewing"), or when a request asks to fix files with problems (task fix-files).
---

# Track an application

## Create

1. Read what you were given: a link (fetch the public page with your web tool; **never** LinkedIn or pages behind a
   login — ask the person to paste the text instead), a pasted post or an e-mail.
2. Pick the slug: `<company>-<role>-<yyyymmdd>`, lowercase ASCII, hyphens only (`nubank-senior-backend-engineer-20261119`).
   If the folder exists, add `-2`, `-3`.
3. Write `applications/<slug>/job.md`:

   ```markdown
   ---
   source: greenhouse # linkedin | gupy | greenhouse | lever | indeed | referral | other
   url: https://… # omit when there is no link
   capturedAt: 2026-11-19T10:00:00Z
   ---

   # <role> — <company>

   <the job post, in Markdown, complete: do not summarize it>
   ```

4. Write `applications/<slug>/application.json` with what the post says. Required: `slug` (= the folder), `company`,
   `role`, `source`, `status` (`saved` unless the person says they applied), `createdAt`, `updatedAt` (ISO date-time
   with `Z` or an offset). Fill `location`, `workModel` (`remote` | `hybrid` | `onsite`), `seniority`, `contract`
   (`clt` | `pj` | `contractor` | `permanent` | `temporary` | `internship` | `other`) and `salary`
   (`{ "min", "max", "currency": "BRL", "period": "month" }` + `"salaryKind": "announced"`) only when stated.
   `pros` and `cons`: short sentences from the post, from the person's point of view (their profile says what they
   want: work models, relocation, salary).
5. Validate both files: `node .mzn/validate.mjs applications/<slug>/application.json` (and `job.md`).

## Update (an e-mail, a status change, a new stage)

- Read `application.json`, change only what the news says, set `updatedAt` to now, keep everything else.
- New interview stage: add to `stages` (`{ "type": "technical", "date": "2026-11-25", "result": "scheduled" }`).
  Types: `hr_screening`, `technical`, `client`, `hiring_manager`, `live_coding`, `system_design`, `take_home_review`,
  `panel`, `language`, `final_executive`, `case_study`, `async_video`.
- A deadline or something to do: add to `nextSteps` (`{ "what": "…", "due": "2026-11-21", "done": false }`).
- A contact: `{ "name": "Carla", "role": "Recruiter" }` — **only name and role**, never e-mail, phone or profile link.
- A pasted e-mail goes to `messages/<yyyy-mm-dd>-<n>.md` as it is (remove signatures with phone numbers).
- Status: `saved` → `applied` → `screening` → `interviewing` → `offer` → `accepted`, or `rejected`, `withdrawn`,
  `ghosted` (no answer for weeks). When it becomes `applied`, set `appliedAt`.

## Fix files with problems (task fix-files)

Run `node .mzn/validate.mjs --all`, read each problem (they name the field), fix the file, and run it again until
everything passes. Never "fix" by deleting the person's data: when unsure, ask.
