import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '../config.js'
import { listIndexed, statusHistory, syncIndex } from './applicationIndex.js'
import { openDb, type DatabaseSync } from './db.js'
import { checkWorkspace, listFiles, readApplication, writeApplication, workspacePath } from './workspace.js'

const SLUG = 'acme-pagamentos-backend-engineer-20261110'
const appFile = () => workspacePath('applications', SLUG, 'application.json')
let db: DatabaseSync

beforeEach(() => {
  rmSync(config.workspaceFolder, { recursive: true, force: true })
  cpSync(path.join(config.root, 'test', 'fixtures', 'sample-workspace'), config.workspaceFolder, { recursive: true })
  db = openDb(':memory:')
})

function setStatus(status: string) {
  const data = JSON.parse(readFileSync(appFile(), 'utf8'))
  writeFileSync(appFile(), JSON.stringify({ ...data, status }))
}

describe('the workspace repository', () => {
  it('lists files, skipping the app state and symbolic links', () => {
    mkdirSync(workspacePath('.mzn'))
    writeFileSync(workspacePath('.mzn', 'state.sqlite'), '')
    // creating a symlink on Windows needs admin rights or developer mode: test the skip where it is cheap
    if (process.platform !== 'win32') {
      const outside = path.join(tmpdir(), 'mzn-outside.json')
      writeFileSync(outside, '{}')
      symlinkSync(outside, workspacePath('profile', 'linked.json'))
    }
    const files = listFiles()
    expect(files).toContain('profile/profile.json')
    expect(files.some((f) => f.startsWith('.mzn'))).toBe(false)
    expect(files).not.toContain('profile/linked.json')
  })

  it('every fixture file is valid', () => {
    const reports = checkWorkspace()
    expect(reports.length).toBe(10)
    expect(reports.filter((r) => r.problems.length)).toEqual([])
  })

  it('reads an application, and reports a broken one instead of throwing', () => {
    expect(readApplication(SLUG)?.application?.company).toBe('Acme Pagamentos')
    setStatus('waiting')
    const broken = readApplication(SLUG)!
    expect(broken.application).toBeNull()
    expect(broken.problems[0]).toMatch(/^status: /)
    expect(readApplication('../profile')).toBeNull()
  })

  it('writes an application atomically, validated, with the defaults filled in', () => {
    const saved = writeApplication({
      slug: 'beta-dev-20261119',
      company: 'Beta',
      role: 'Dev',
      source: 'referral',
      status: 'saved',
      createdAt: '2026-11-19T10:00:00Z',
      updatedAt: '2026-11-19T10:00:00Z',
    })
    expect(saved.stages).toEqual([])
    expect(readApplication('beta-dev-20261119')?.application).toEqual(saved)
    expect(() => writeApplication({ ...saved, status: 'nope' as 'saved' })).toThrow()
  })
})

describe('the application index', () => {
  it('indexes the valid files and records the first status', () => {
    syncIndex(db, '2026-11-19T10:00:00Z')
    expect(listIndexed(db)).toEqual([
      expect.objectContaining({ slug: SLUG, company: 'Acme Pagamentos', status: 'interviewing', workModel: 'remote' }),
    ])
    expect(statusHistory(SLUG, db)).toEqual([{ from: null, to: 'interviewing', at: '2026-11-19T10:00:00Z' }])
  })

  it('records a status change made by editing the file, and only once', () => {
    syncIndex(db, '2026-11-19T10:00:00Z')
    setStatus('offer')
    syncIndex(db, '2026-11-20T10:00:00Z')
    syncIndex(db, '2026-11-21T10:00:00Z')
    expect(statusHistory(SLUG, db).map((c) => [c.from, c.to])).toEqual([
      [null, 'interviewing'],
      ['interviewing', 'offer'],
    ])
  })

  it('keeps the last good row while the file is broken, and drops it when the folder is gone', () => {
    syncIndex(db)
    setStatus('???')
    syncIndex(db)
    expect(listIndexed(db)[0]?.status).toBe('interviewing')
    rmSync(workspacePath('applications', SLUG), { recursive: true })
    syncIndex(db)
    expect(listIndexed(db)).toEqual([])
  })

  it('the index keeps no salary or contacts', () => {
    syncIndex(db)
    const row = db.prepare('SELECT * FROM applications').get() as Record<string, unknown>
    expect(Object.keys(row)).not.toContain('salary')
    expect(JSON.stringify(row)).not.toMatch(/15000|Carla/)
  })
})
