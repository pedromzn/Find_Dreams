/**
 * Keeps the SQLite index in step with the files. The files are the truth: `syncIndex` reads every valid
 * `application.json`, upserts its row, records a status change in the history (the AI or the person may change the
 * status by editing the file — the history must still see it), and drops rows whose folder is gone.
 *
 * Invalid files keep their last good row: a typo the AI is about to fix should not make an application vanish from
 * the board.
 */

import type { IndexedApplication } from '../../shared/api.js'
import type { Status } from '../../shared/application.js'
import { getDb, transaction, type DatabaseSync } from './db.js'
import { listApplicationSlugs, readApplications } from './workspace.js'

export interface StatusChange {
  from: Status | null
  to: Status
  at: string
}

export type { IndexedApplication }

export function syncIndex(db: DatabaseSync = getDb(), now = new Date().toISOString()): void {
  const present = new Set(listApplicationSlugs())
  const read = readApplications()
  transaction(db, () => {
    const current = db.prepare('SELECT status FROM applications WHERE slug = ?')
    const upsert = db.prepare(`
      INSERT INTO applications (slug, company, role, status, source, work_model, applied_at, updated_at, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (slug) DO UPDATE SET company = excluded.company, role = excluded.role, status = excluded.status,
        source = excluded.source, work_model = excluded.work_model, applied_at = excluded.applied_at,
        updated_at = excluded.updated_at, indexed_at = excluded.indexed_at`)
    const history = db.prepare('INSERT INTO status_history (slug, from_status, to_status, at) VALUES (?, ?, ?, ?)')
    for (const { slug, application: a } of read) {
      if (!a) continue
      const before = (current.get(slug) as { status: Status } | undefined)?.status ?? null
      upsert.run(
        slug,
        a.company,
        a.role,
        a.status,
        a.source,
        a.workModel ?? null,
        a.appliedAt ?? null,
        a.updatedAt,
        now,
      )
      if (before !== a.status) history.run(slug, before, a.status, now)
    }
    const stale = (db.prepare('SELECT slug FROM applications').all() as Array<{ slug: string }>).filter(
      (r) => !present.has(r.slug),
    )
    const remove = db.prepare('DELETE FROM applications WHERE slug = ?')
    for (const { slug } of stale) remove.run(slug)
  })
}

export function listIndexed(db: DatabaseSync = getDb()): IndexedApplication[] {
  const rows = db
    .prepare(
      `SELECT slug, company, role, status, source, work_model AS workModel, applied_at AS appliedAt,
        updated_at AS updatedAt FROM applications ORDER BY updated_at DESC`,
    )
    .all()
  return rows as unknown as IndexedApplication[]
}

export function statusHistory(slug: string, db: DatabaseSync = getDb()): StatusChange[] {
  const rows = db
    .prepare('SELECT from_status AS "from", to_status AS "to", at FROM status_history WHERE slug = ? ORDER BY id')
    .all(slug)
  return rows as unknown as StatusChange[]
}
