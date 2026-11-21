---
name: salary-research
description: Use when the person (or a request with task salary-research) wants to know what a role pays and what to ask for — public salary sources cited, compared with their expectation and the job's contract, in applications/<slug>/salary.md.
---

# Research the salary

Read `application.json` (role, seniority, location, work model, contract, announced salary), `job.md`, `company.md`
and `profile/profile.json` (`salaryExpectation`, location).

## Sources

Public, readable without login: salary guides from recruiting firms (Robert Half, Michael Page, Hays…), public salary
surveys (e.g. the Código Fonte TV / Pesquisa Salarial, Stack Overflow survey, levels.fyi for big tech), the company's
own posts with ranges, and aggregate sites (Glassdoor) **as tendencies**. Search for the **role, seniority and
place**, never for the person. Note each source's year; prefer the last 12 months.

## What to write

- The **market range** for this role/seniority/place, and how the sources differ.
- **Contract conversion** when it matters: CLT vs PJ (a PJ figure must cover 13th salary, vacation, FGTS, benefits —
  roughly 1.4–1.6× the CLT gross), contractor in USD vs local.
- **Where the job's announced range sits**, and where the person's expectation sits.
- **What to ask for**: a range to state (low = the floor the person accepts, high = an ambitious but defensible
  figure), and two or three sentences to say it.
- Benefits worth weighing (health plan, equity, bonus, remote allowance).

## Save `applications/<slug>/salary.md`

```markdown
---
researchedAt: 2026-11-21
low: R$ 17.000
high: R$ 21.000
---

# Salary — Backend Engineer at Acme

## Market range

…

## Sources

- [Guia Salarial 2026 — Robert Half](https://…) (2026)
```

At least one link. Validate: `node .mzn/validate.mjs applications/<slug>/salary.md`.
