/**
 * The agent kit in the workspace. `agent-kit/` (AGENTS.md, CLAUDE.md, the Cursor rule and the skills) is the product's
 * brain for the person's AI; the app copies it into the workspace on start and on every new version.
 *
 * Never overwrite an edit without asking: `.mzn/agent-kit.json` records the hash of every file as the app last wrote
 * it. On an update, a file whose hash still matches is replaced; a file the person (or their AI) changed is left alone,
 * the new version goes next to it as `<file>.new`, and the conflict is listed until the person chooses.
 *
 * Also written on start (and only touched by the app): `.mzn/schemas/*.schema.json` for the AI to read, and the
 * validator the AI runs, `.mzn/validate.mjs`, with `.mzn/session.json` (this run's port and API token).
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { SCHEMAS } from '../../shared/workspace.js'
import { config } from '../config.js'
import { HttpError } from '../errors.js'
import { validateToken } from '../security.js'
import { workspacePath, writeFileAtomic } from '../store/workspace.js'

export interface KitStatus {
  version: string
  installed: string | null
  conflicts: string[]
}

const manifestSchema = z.object({
  version: z.string(),
  files: z.record(z.string(), z.string()),
  conflicts: z.array(z.string()).default([]),
})
type Manifest = z.infer<typeof manifestSchema>

const hash = (content: Buffer | string) => createHash('sha256').update(content).digest('hex')

/** Every file of the kit, as POSIX paths relative to it (VERSION stays in the app). */
export function kitFiles(folder = config.agentKitFolder, prefix = ''): string[] {
  if (!existsSync(folder)) return []
  return readdirSync(folder, { withFileTypes: true })
    .flatMap((e) => {
      const relative = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) return kitFiles(path.join(folder, e.name), relative)
      return e.isFile() && relative !== 'VERSION' ? [relative] : []
    })
    .sort()
}

export const kitVersion = () => readFileSync(path.join(config.agentKitFolder, 'VERSION'), 'utf8').trim()

/**
 * The manifest lives in the workspace, where the AI can write: never trust its paths. Only real kit files survive the
 * read, so a planted `../../somewhere` can never reach a write or a delete.
 */
function readManifest(): Manifest | null {
  try {
    const raw = manifestSchema.parse(JSON.parse(readFileSync(workspacePath('.mzn', 'agent-kit.json'), 'utf8')))
    const known = new Set(kitFiles())
    return {
      version: raw.version,
      files: Object.fromEntries(Object.entries(raw.files).filter(([f]) => known.has(f))),
      conflicts: raw.conflicts.filter((f) => known.has(f)),
    }
  } catch {
    return null
  }
}

function writeManifest(manifest: Manifest) {
  writeFileAtomic(workspacePath('.mzn', 'agent-kit.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

/** Installs or updates the kit. Idempotent: a second call with the same version changes nothing. */
export function installKit(): KitStatus {
  const version = kitVersion()
  const previous = readManifest()
  const files: Record<string, string> = {}
  const conflicts = new Set(previous?.conflicts ?? [])
  for (const file of kitFiles()) {
    const content = readFileSync(path.join(config.agentKitFolder, file))
    const fresh = hash(content)
    const target = workspacePath(file)
    if (!existsSync(target)) {
      writeFileAtomic(target, content.toString('utf8'))
      files[file] = fresh
      conflicts.delete(file)
      continue
    }
    const current = hash(readFileSync(target))
    const lastWritten = previous?.files[file]
    if (current === fresh) {
      files[file] = fresh
      conflicts.delete(file)
    } else if (lastWritten && current === lastWritten) {
      // untouched since the app wrote it: safe to update
      writeFileAtomic(target, content.toString('utf8'))
      files[file] = fresh
      conflicts.delete(file)
    } else {
      // edited by the person or their AI (or a file that was there before the kit): keep it, offer the new one
      writeFileAtomic(`${target}.new`, content.toString('utf8'))
      files[file] = lastWritten ?? ''
      conflicts.add(file)
    }
  }
  writeManifest({ version, files, conflicts: [...conflicts].sort() })
  writeSchemas()
  return { version, installed: version, conflicts: [...conflicts].sort() }
}

export function kitStatus(): KitStatus {
  const manifest = readManifest()
  return { version: kitVersion(), installed: manifest?.version ?? null, conflicts: manifest?.conflicts ?? [] }
}

/** The person chose: `replace` takes the new version (`.new`), `keep` keeps theirs. */
export function resolveConflict(file: string, choice: 'replace' | 'keep'): KitStatus {
  const manifest = readManifest()
  // the file must be a real kit file (the manifest is already filtered, but say it here too: this path is written)
  if (!kitFiles().includes(file) || !manifest?.conflicts.includes(file)) {
    throw new HttpError(404, 'No such conflict.', 'not_found')
  }
  const target = workspacePath(file)
  const fresh = readFileSync(path.join(config.agentKitFolder, file))
  if (choice === 'replace') writeFileAtomic(target, fresh.toString('utf8'))
  rmSync(`${target}.new`, { force: true })
  manifest.files[file] = choice === 'replace' ? hash(fresh) : hash(readFileSync(target))
  manifest.conflicts = manifest.conflicts.filter((f) => f !== file)
  writeManifest(manifest)
  return kitStatus()
}

function writeSchemas() {
  const folder = workspacePath('.mzn', 'schemas')
  mkdirSync(folder, { recursive: true })
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
    // temp file + rename: a symlink planted at the target is replaced, never followed
    writeFileAtomic(path.join(folder, `${name}.schema.json`), `${JSON.stringify(json, null, 2)}\n`)
  }
}

/**
 * The validator the AI runs (`node .mzn/validate.mjs <file…> | --all`). Plain Node, no dependency: it asks the
 * running app (`.mzn/session.json`) to validate with the real schemas, so the rules live in one place.
 */
const VALIDATOR = `#!/usr/bin/env node
// Written by the Find Dreams app. Validates workspace files with the app's own rules.
// Usage: node .mzn/validate.mjs <file> [more files]   |   node .mzn/validate.mjs --all
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const real = (p) => {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}
// both sides through realpath: a workspace behind a symlink (iCloud Documents, /var on macOS) must still match
const workspace = real(resolve(here, '..'))
let session
try {
  session = JSON.parse(readFileSync(join(here, 'session.json'), 'utf8'))
} catch {
  console.error('The Find Dreams app is not running: open it and try again.')
  process.exit(2)
}
const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: node .mzn/validate.mjs <file> [more files] | --all')
  process.exit(2)
}
const all = args.includes('--all')
const files = all ? [] : args.map((f) => relative(workspace, real(resolve(process.cwd(), f))).split('\\\\').join('/'))
let answer
try {
  const res = await fetch(\`http://127.0.0.1:\${session.port}/api/validate\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-MZN-Token': session.token },
    body: JSON.stringify(all ? { all: true } : { files }),
  })
  answer = await res.json()
  if (!res.ok) throw new Error(answer.error ?? res.status)
} catch (e) {
  console.error('Could not reach the Find Dreams app (is it open?): ' + (e.message ?? e))
  process.exit(2)
}
let problems = 0
for (const r of answer.data) {
  if (r.problems.length === 0) console.log('[ok]       ' + r.file)
  else {
    problems += r.problems.length
    console.log('[problem]  ' + r.file)
    for (const p of r.problems) console.log('           - ' + p)
  }
}
console.log(problems ? '\\n' + problems + ' problem(s).' : '\\nAll valid.')
process.exit(problems ? 1 : 0)
`

/**
 * Called once the server listens: the port is only known then (random in the desktop app). The token written here is
 * the narrow VALIDATE token, which only opens \`/api/validate\` (\`security.ts\`): the AI reads this file and must not
 * get the page's full session (the CV, salary, messages). Readable by the person's user only.
 */
export function writeSession(port: number, token: string = validateToken) {
  writeFileAtomic(
    workspacePath('.mzn', 'session.json'),
    `${JSON.stringify({ port, token, pid: process.pid })}\n`,
    0o600,
  )
  writeFileAtomic(workspacePath('.mzn', 'validate.mjs'), VALIDATOR)
}

/** On shutdown: a stale session would make the validator talk to a dead port (or someone else's). */
export function clearSession() {
  rmSync(workspacePath('.mzn', 'session.json'), { force: true })
}
