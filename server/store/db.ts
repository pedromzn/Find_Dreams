/**
 * The app state: a local SQLite (`node:sqlite`, built into Node) at `<workspace>/.mzn/state.sqlite`. It holds only what
 * the files cannot: the index of applications (for fast lists and filters), the status history (the files keep only
 * the current status), and preferences. Content lives in files, never here — delete this database and the app
 * rebuilds the index from the workspace.
 *
 * `openDb(':memory:')` is for tests; `getDb()` is the app singleton (opens on first use).
 *
 * Copied from learning-anything's `server/progress/db.ts`. Desktop note: if the Node inside the chosen Electron lacks
 * a stable `node:sqlite`, swap the driver for better-sqlite3 behind this same module (docs/PLAN.md, section 11).
 */

import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { DatabaseSync as SqliteDatabase } from 'node:sqlite'
import { config } from '../config.js'

export type DatabaseSync = SqliteDatabase

/* the "SQLite is an experimental feature" warning shows once per process; hide only that one, keep the other warnings */
const emitWarning = process.emitWarning.bind(process)
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const text = typeof warning === 'string' ? warning : warning.message
  if (/SQLite/i.test(text)) return
  return (emitWarning as (...a: unknown[]) => void)(warning, ...rest)
}) as typeof process.emitWarning

/* loaded AFTER the filter above: a static `import` would evaluate the module (and emit the warning) before it */
const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

/** Bumped on every schema change; the migrations live in `migrate`. */
const VERSION = 1

/**
 * v1: the application index, the status history and the preferences. The index keeps no salary, no contact and no
 * notes: only what the board needs to list and filter.
 */
const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS applications (
  slug TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  work_model TEXT,
  applied_at TEXT,
  updated_at TEXT NOT NULL,
  indexed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS status_history_by_slug ON status_history (slug, at);
CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

function migrate(db: DatabaseSync): void {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  if (current >= VERSION) return
  db.exec('BEGIN IMMEDIATE')
  try {
    if (current < 1) db.exec(SCHEMA_V1)
    db.exec(`PRAGMA user_version = ${VERSION}`)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function openDb(filePath: string): DatabaseSync {
  if (filePath !== ':memory:') mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new Sqlite(filePath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

let instance: DatabaseSync | null = null

/** The app database. Tests swap it for a `:memory:` one with `setDb`. */
export function getDb(): DatabaseSync {
  instance ??= openDb(path.join(config.workspaceFolder, '.mzn', 'state.sqlite'))
  return instance
}

export function setDb(db: DatabaseSync | null): void {
  instance = db
}

/** Runs `f` in an immediate transaction (takes the write lock up front, no upgrade deadlock). */
export function transaction<T>(db: DatabaseSync, f: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = f()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
