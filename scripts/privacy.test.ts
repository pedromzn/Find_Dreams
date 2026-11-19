import { describe, expect, it } from 'vitest'
import { forbiddenPaths } from './privacy.js'

describe('the privacy gate', () => {
  it('lets source, docs and fixtures through', () => {
    expect(
      forbiddenPaths([
        'server/main.ts',
        'docs/PLAN.md',
        '.env.example',
        'test/fixtures/sample-workspace/profile/profile.json',
        'test/fixtures/sample-workspace/applications/acme-x-20261110/application.json',
        'server/applications/routes.ts',
      ]),
    ).toEqual([])
  })

  it.each([
    'workspace/profile/cv.md',
    'profile/profile.json',
    'applications/acme-x-20261110/application.json',
    'requests/abc.json',
    'docs/my-cv.pdf',
    'test/fixtures/cv.docx',
    'evals/state.sqlite',
    '.env',
    'server/.env.local',
    'some/where/.mzn/state.sqlite-wal',
  ])('stops %s', (file) => {
    expect(forbiddenPaths([file])).toHaveLength(1)
  })
})
