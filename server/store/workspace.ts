/**
 * The workspace repository: reads (and, for the app's own forms, writes) the files in the person's workspace folder,
 * validating each one with the same rules the AI gets (`shared/workspace.ts`).
 *
 * Security: a slug goes through the slug regex before touching the disk, the walk never follows symbolic links (the
 * AI could create one pointing outside the workspace), and `.mzn/` (the app's internal state) is never listed.
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { applicationSchema, type Application, type ApplicationInput } from '../../shared/application.js'
import { SLUG_PATTERN } from '../../shared/common.js'
import { classify, validateFile } from '../../shared/workspace.js'
import { config } from '../config.js'
import { HttpError } from '../errors.js'

/** Folders the walk skips: the app's state, the agent kit's tool folders and version control. */
const SKIPPED = new Set(['.mzn', '.git', '.claude', '.cursor', 'node_modules'])

/** A file the AI writes is small; anything bigger is a mistake (or a pasted binary). */
const MAX_FILE_BYTES = 2 * 1024 * 1024

export const validSlug = (slug: string) => SLUG_PATTERN.test(slug) && slug.length <= 80

export const workspacePath = (...parts: string[]) => path.join(config.workspaceFolder, ...parts)

/** Every regular file under the workspace, as POSIX paths relative to it (sorted, symlinks skipped). */
export function listFiles(folder = config.workspaceFolder, prefix = ''): string[] {
  if (!existsSync(folder)) return []
  const files: string[] = []
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name)) files.push(...listFiles(path.join(folder, entry.name), relative))
    } else if (entry.isFile()) files.push(relative)
  }
  return files.sort()
}

export interface FileReport {
  file: string
  problems: string[]
}

/** Validates one file by its workspace-relative path. `null` = not a file the app validates. */
export function checkFile(relative: string): FileReport | null {
  if (!classify(relative)) return null
  const absolute = workspacePath(relative)
  if (!absolute.startsWith(config.workspaceFolder + path.sep))
    return { file: relative, problems: ['Outside the workspace.'] }
  const stat = lstatSync(absolute, { throwIfNoEntry: false })
  if (!stat?.isFile()) return { file: relative, problems: ['File not found.'] }
  if (stat.size > MAX_FILE_BYTES) return { file: relative, problems: ['File too large (over 2 MB).'] }
  return { file: relative, problems: validateFile(relative, readFileSync(absolute, 'utf8')) ?? [] }
}

/** Every validated file in the workspace, with its problems. */
export function checkWorkspace(): FileReport[] {
  return listFiles()
    .map(checkFile)
    .filter((r): r is FileReport => r !== null)
}

// ── applications ─────────────────────────────────────────────────────────────

export interface ReadApplication {
  slug: string
  /** null when application.json is missing or invalid */
  application: Application | null
  problems: string[]
}

export function listApplicationSlugs(): string[] {
  const folder = workspacePath('applications')
  if (!existsSync(folder)) return []
  return readdirSync(folder, { withFileTypes: true })
    .filter((e) => e.isDirectory() && validSlug(e.name))
    .map((e) => e.name)
    .sort()
}

export function readApplication(slug: string): ReadApplication | null {
  if (!validSlug(slug)) return null
  if (!existsSync(workspacePath('applications', slug))) return null
  const report = checkFile(`applications/${slug}/application.json`)!
  if (report.problems.length) return { slug, application: null, problems: report.problems }
  const raw = JSON.parse(readFileSync(workspacePath('applications', slug, 'application.json'), 'utf8')) as unknown
  return { slug, application: applicationSchema.parse(raw), problems: [] }
}

export function readApplications(): ReadApplication[] {
  return listApplicationSlugs()
    .map(readApplication)
    .filter((a): a is ReadApplication => a !== null)
}

/**
 * Writes a whole file atomically (temp file + rename): the AI or the file watcher never read half a JSON, and a crash
 * mid-write leaves the old version intact.
 */
export function writeFileAtomic(absolute: string, content: string): void {
  mkdirSync(path.dirname(absolute), { recursive: true })
  const temporary = `${absolute}.${process.pid}.tmp`
  writeFileSync(temporary, content)
  renameSync(temporary, absolute)
}

/** Validates and saves `application.json` (the app's forms; the AI writes the file directly). */
export function writeApplication(input: ApplicationInput): Application {
  const application = applicationSchema.parse(input)
  if (!validSlug(application.slug)) throw new HttpError(422, 'Invalid slug.', 'invalid')
  writeFileAtomic(
    workspacePath('applications', application.slug, 'application.json'),
    `${JSON.stringify(application, null, 2)}\n`,
  )
  return application
}
