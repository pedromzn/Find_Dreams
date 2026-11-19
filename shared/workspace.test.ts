import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { applicationSlug } from './application.js'
import { payRangeSchema, slugify } from './common.js'
import { classify, readFrontMatter, validateFile } from './workspace.js'

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'test',
  'fixtures',
  'sample-workspace',
)
const APP = 'applications/acme-pagamentos-backend-engineer-20261110'
const fixture = (file: string) => readFileSync(path.join(FIXTURES, file), 'utf8')
const json = (file: string) => JSON.parse(fixture(file)) as Record<string, unknown>

describe('the workspace map', () => {
  it.each([
    ['profile/profile.json', { kind: 'profile' }],
    ['profile/cv.md', { kind: 'cv' }],
    [`${APP}/application.json`, { kind: 'application', application: 'acme-pagamentos-backend-engineer-20261110' }],
    [`${APP}/interviewers/hr-screening.json`, { kind: 'persona', name: 'hr-screening' }],
    [`${APP}/interviews/2026-11-12-hr_screening/transcript.json`, { kind: 'session', name: '2026-11-12-hr_screening' }],
    [`${APP}/debriefs/2026-11-14-hr_screening.json`, { kind: 'debrief' }],
    ['applications\\acme-x-20261110\\fit.json', { kind: 'fit' }],
  ])('classifies %s', (file, expected) => {
    expect(classify(file)).toMatchObject(expected)
  })

  it.each([
    'AGENTS.md',
    `${APP}/messages/2026-11-11-recruiter.md`,
    'applications/../profile/profile.json',
    'applications/Acme/application.json',
    `${APP}/interviews/2026-11-12-chat/transcript.json`,
  ])('ignores %s', (file) => {
    expect(classify(file)).toBeNull()
  })
})

describe('the fictional fixture workspace', () => {
  it.each([
    'profile/profile.json',
    'profile/cv.md',
    `${APP}/application.json`,
    `${APP}/job.md`,
    `${APP}/company.md`,
    `${APP}/fit.json`,
    `${APP}/interviewers/hr-screening.json`,
    `${APP}/interviews/2026-11-12-hr_screening/transcript.json`,
    `${APP}/interviews/2026-11-12-hr_screening/feedback.json`,
    `${APP}/debriefs/2026-11-14-hr_screening.json`,
  ])('%s is valid', (file) => {
    expect(validateFile(file, fixture(file))).toEqual([])
  })
})

describe('validation problems the AI must fix', () => {
  const application = json(`${APP}/application.json`)
  const check = (data: unknown, file = `${APP}/application.json`) => validateFile(file, JSON.stringify(data))!

  it('broken JSON', () => {
    expect(validateFile(`${APP}/application.json`, '{ "slug": ')![0]).toMatch(/^Invalid JSON/)
  })

  it('unknown status, with the field path', () => {
    expect(check({ ...application, status: 'waiting' })[0]).toMatch(/^status: /)
  })

  it('an unknown field (typos do not pass silently)', () => {
    expect(check({ ...application, compnay: 'x' })[0]).toMatch(/compnay/)
  })

  it('a slug that does not match the folder', () => {
    expect(check({ ...application, slug: 'other-company-20261110' })).toEqual([
      'slug: must match the folder name ("acme-pagamentos-backend-engineer-20261110").',
    ])
  })

  it('a contact with an e-mail (only name and role are kept)', () => {
    expect(check({ ...application, contacts: [{ name: 'Carla', role: 'Recruiter', email: 'c@x.com' }] })[0]).toMatch(
      /contacts\.0/,
    )
  })

  it('a non-http link', () => {
    expect(check({ ...application, url: 'javascript:alert(1)' })[0]).toMatch(/^url: /)
  })

  it('a persona whose id is not its file name, and one without basis', () => {
    const persona = json(`${APP}/interviewers/hr-screening.json`)
    expect(check({ ...persona, id: 'tech' }, `${APP}/interviewers/hr-screening.json`)[0]).toMatch(/^id: /)
    expect(check({ ...persona, basis: [] }, `${APP}/interviewers/hr-screening.json`)[0]).toMatch(/^basis: /)
  })

  it('a session in the wrong folder type', () => {
    const session = json(`${APP}/interviews/2026-11-12-hr_screening/transcript.json`)
    const file = `${APP}/interviews/2026-11-12-technical/transcript.json`
    expect(check(session, file)).toEqual(['interviewType: must match the folder or file name ("technical").'])
  })

  it('a fit without sources', () => {
    expect(check({ ...json(`${APP}/fit.json`), sources: [] }, `${APP}/fit.json`)[0]).toMatch(/^sources: /)
  })

  it('a job post without front matter, and company research without a link', () => {
    expect(validateFile(`${APP}/job.md`, '# A job')).toEqual([
      'Missing the front matter: start the file with a `---` block of `key: value` lines.',
    ])
    expect(validateFile(`${APP}/company.md`, '---\nresearchedAt: 2026-11-10\n---\nNo sources here.')).toEqual([
      'Company research must cite at least one public source link.',
    ])
  })

  it('a job post with a wrong source', () => {
    const problems = validateFile(`${APP}/job.md`, '---\nsource: twitter\ncapturedAt: 2026-11-10\n---\nText')!
    expect(problems[0]).toMatch(/^front matter source: /)
  })
})

describe('helpers', () => {
  it('slugify drops accents and symbols', () => {
    expect(slugify('São Paulo — Pagamentos & Cia.')).toBe('sao-paulo-pagamentos-cia')
  })

  it('applicationSlug builds company-role-date', () => {
    expect(applicationSlug('Nubank', 'Senior Backend Engineer', '2026-11-19T10:00:00Z')).toBe(
      'nubank-senior-backend-engineer-20261119',
    )
  })

  it('a pay range needs one end and min ≤ max', () => {
    expect(payRangeSchema.safeParse({ currency: 'BRL' }).success).toBe(false)
    expect(payRangeSchema.safeParse({ min: 10, max: 5, currency: 'BRL' }).success).toBe(false)
    expect(payRangeSchema.safeParse({ max: 5000, currency: 'brl' }).success).toBe(false)
    expect(payRangeSchema.parse({ max: 5000, currency: 'USD' }).period).toBe('month')
  })

  it('front matter: key: value lines, URLs with colons intact', () => {
    expect(readFrontMatter('---\nurl: https://a.b/c?x=1\n---\nbody')).toEqual({
      data: { url: 'https://a.b/c?x=1' },
      body: 'body',
    })
    expect(readFrontMatter('no front matter')).toBeNull()
  })
})
