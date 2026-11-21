---
name: cover-letter
description: Use when the person (or a request with task cover-letter) wants a cover letter for an application, or wants their letter reviewed — applications/<slug>/cover-letter.md in the requested tone and language, grounded in the CV. Never sends anything.
---

# Write (or review) the cover letter

Read `application.json`, `job.md`, `company.md` and `fit.json` if they exist, `profile/profile.json`, `profile/cv.md`
and, if present, the tailored `resume.json` and the current `cover-letter.md`.

The request's `details` say the tone (`formal`, `direct` or `warm`; default `direct`) and anything the person wants
said. If it says "review", read the existing letter, keep what works, fix what does not, and list your changes in two
or three lines in your final message to the person (not in the file).

## The letter

- **250–400 words, 3–4 paragraphs.** No "To whom it may concern" when the post names the team; no clichés ("I am
  writing to express my interest…", "passionate", "team player").
- Paragraph 1: the role and the one reason you fit, concretely.
- Paragraph 2–3: two stories from the CV that answer what the post values, with results. Use `fit.json`'s
  `talkingPoints` when they exist. **Never invent experience** — a gap is better left unsaid than faked.
- Last paragraph: why this company (from `company.md`, with substance, not flattery) and a short close.
- Sign with the person's name. No phone or e-mail unless the person asks.
- Brazilian Portuguese letters are a bit shorter and less formal than American English ones; follow the market of the
  job.

## Save `applications/<slug>/cover-letter.md`

```markdown
---
tone: direct
language: pt-BR
generatedAt: 2026-11-21T10:00:00Z
---

Olá, time da Acme,

…

Ana Souza
```

Validate: `node .mzn/validate.mjs applications/<slug>/cover-letter.md`.
