/**
 * Preferences in SQLite (`preferences` table). The interface language lives here too, not only in `localStorage`:
 * the desktop app serves the page on a random port, so the browser storage (per origin) forgets it every launch.
 */

import { languageSchema, type Language } from '../../shared/languages.js'
import { getDb, type DatabaseSync } from './db.js'

export function getPreference(key: string, db: DatabaseSync = getDb()): string | null {
  const row = db.prepare('SELECT value FROM preferences WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setPreference(key: string, value: string | null, db: DatabaseSync = getDb()): void {
  if (value === null) db.prepare('DELETE FROM preferences WHERE key = ?').run(key)
  else
    db.prepare(
      'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    ).run(key, value)
}

export function getLanguage(db?: DatabaseSync): Language | null {
  const parsed = languageSchema.safeParse(getPreference('language', db))
  return parsed.success ? parsed.data : null
}
