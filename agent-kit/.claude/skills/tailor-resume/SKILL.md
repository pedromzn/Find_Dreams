---
name: tailor-resume
description: Use when the person (or a request with task tailor-resume) wants a structured résumé — the base one from the CV (profile/resume.json), a translation of it (profile/resume.<language>.json), or a version tailored to one job (applications/<slug>/resume.json) that passes ATS screening without inventing anything.
---

# Build or tailor the résumé

Read `profile/profile.json` and `profile/cv.md`. For a tailored version, also `applications/<slug>/job.md`, `fit.json`
and `company.md` if they exist. The format is `.mzn/schemas/resume.schema.json`.

## Which file

| The request has…                                                    | Write                                         |
| ------------------------------------------------------------------- | --------------------------------------------- |
| an `application`                                                    | `applications/<slug>/resume.json` (tailored)  |
| no `application`, and `profile/resume.json` does not exist yet      | `profile/resume.json` (the base)              |
| no `application`, `profile/resume.json` exists in the same language | `profile/resume.json` (rebuild the base)      |
| no `application`, `profile/resume.json` exists in another language  | `profile/resume.<language>.json` (translated) |

**The base is always `profile/resume.json`**, whatever its language — never `resume.pt-BR.json` or `resume.en.json`
for the first résumé. Those names are only for translations of an existing base. When you write the base and a
`profile/resume.<same language>.json` exists (an earlier mistake), delete that file: the base replaces it.

Keep the `template` of the file you are replacing, if any (the person chose it in the app); otherwise `"modern"`.

## The base résumé

- Everything the CV says, structured: `basics`, a 3–4 line `summary`, `experience` (most recent first, 3–6 bullets
  each), `education`, `skills` grouped (Languages, Frameworks, Data, Cloud, Practices…), `languages`,
  `certifications`, `projects`.
- **Bullets start with a verb and carry a result**: "Cut payment retries 40% with idempotency keys" beats "Responsible
  for payments". Keep every number the CV has; never make one up.
- The person's own contact details (e-mail, phone, public links) come from the CV and the profile.

## A tailored version (ATS)

1. List the post's must-have terms (tools, practices, domain words), as the post spells them.
2. For each term the CV **does** support, make sure it appears in the résumé with the post's spelling (in the summary,
   a bullet or the skills) — "PostgreSQL", not only "Postgres". Lead with the experience that matches best.
3. Terms the CV does **not** support stay out. Never add a skill, a year of experience or a result the person does not
   have. Mention the gap in `tailoring.changes` ("Kubernetes not added: not in the CV").
4. Rewrite the summary for this role, reorder skills and bullets, trim what is irrelevant (keep ~1 page: 450–750
   words).
5. Fill `tailoring`: `application` (the slug), `changes` (what you changed and why, 3–8 lines), `keywordsCovered`.

## A translation

Same content, natural language for the target market: "Desenvolvedor Backend Sênior" ↔ "Senior Backend Developer",
dates and degrees adapted ("Bacharelado em Ciência da Computação" → "B.Sc. in Computer Science"). Do not translate
company or product names.

Validate: `node .mzn/validate.mjs <the file>`.
