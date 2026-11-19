/**
 * The privacy gate: fails when a file that may hold the person's data is tracked by git. `.gitignore` is the first
 * line of defense; this is the second, because `git add -f`, a renamed folder or a careless `.gitignore` edit would
 * slip past the first. Runs in `npm run verify` and in CI.
 *
 *   npm run privacy:check
 *
 * The fictional fixtures (`test/fixtures/`, `evals/`) may hold workspace-shaped files; they still may not hold PDFs,
 * DOCXs or databases.
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'

/** Top-level folders that only exist in a person's workspace. */
const WORKSPACE_ROOTS = new Set(['workspace', 'profile', 'applications', 'requests'])

/** File types that are personal documents or local state, anywhere in the tree. */
const FORBIDDEN_EXTENSIONS = /\.(pdf|docx?|odt|rtf|pages|sqlite3?|db|sqlite-wal|sqlite-shm)$/i

/** Secrets: `.env` and its variants, except the documented example. */
const SECRET_FILES = /(^|\/)\.env(\.(?!example$)[^/]*)?$/

const FIXTURE_ROOTS = ['test/fixtures/', 'evals/']

/** The tracked paths that must not be tracked, each with the reason. */
export function forbiddenPaths(files: string[]): string[] {
  const found: string[] = []
  for (const file of files) {
    const top = file.split('/')[0]!
    if (FORBIDDEN_EXTENSIONS.test(file)) found.push(`${file} (personal document or local database)`)
    else if (SECRET_FILES.test(file)) found.push(`${file} (secrets)`)
    else if (WORKSPACE_ROOTS.has(top) && !FIXTURE_ROOTS.some((f) => file.startsWith(f))) {
      found.push(`${file} (workspace data: ${top}/)`)
    } else if (/(^|\/)\.mzn\//.test(file)) found.push(`${file} (the app's internal state)`)
  }
  return found
}

function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\0').filter(Boolean)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  let files: string[]
  try {
    files = trackedFiles()
  } catch {
    console.log('privacy:check skipped: not a git checkout.')
    process.exit(0)
  }
  const found = forbiddenPaths(files)
  if (found.length) {
    console.error(`These files may hold personal data and must not be in git:\n  ${found.join('\n  ')}`)
    console.error('\nRemove them from the index (git rm --cached <file>) and check .gitignore.')
    process.exit(1)
  }
  console.log(`privacy:check ok (${files.length} tracked files).`)
}
