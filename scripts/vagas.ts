/**
 * The workspace CLI for whoever develops the app (and their AI): `status`, `validate` and `schemas`. Output in English;
 * exit code 1 when there is a problem. The person's own AI does not use this (there is no npm in their workspace): it
 * calls the same validation through the app (`shared/workspace.ts` is the single source).
 *
 *   npm run vagas:status [-- --workspace <dir>]
 *   npm run vagas:validate -- <file|slug> [--workspace <dir>]     |     npm run vagas:validate -- --all
 *   npm run vagas:schemas [-- --check]
 */

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import '../shared/zodPortuguese.js'
import { SCHEMAS } from '../shared/workspace.js'
import { config } from '../server/config.js'
import {
  checkFile,
  checkWorkspace,
  listFiles,
  readApplications,
  validSlug,
  type FileReport,
} from '../server/store/workspace.js'

// zod messages in English here: the reader is a developer or their AI, and the docs are in English
// (`customError` must be cleared too: the Portuguese map set by zodPortuguese.ts wins over any locale)
z.config({ ...z.locales.en(), customError: undefined })

// ── arguments ───────────────────────────────────────────────────────────────

export interface Args {
  positional: string[]
  all: boolean
  check: boolean
  workspace: string | null
}

export function readArgs(argv: string[]): Args {
  const r: Args = { positional: [], all: false, check: false, workspace: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--all') r.all = true
    else if (a === '--check') r.check = true
    else if (a === '--workspace') {
      const dir = argv[++i]
      if (!dir) throw new Error('--workspace needs a folder.')
      r.workspace = dir
    } else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`)
    else r.positional.push(a)
  }
  return r
}

// ── output ───────────────────────────────────────────────────────────────────

export function formatReports(reports: FileReport[]): { text: string; problems: number } {
  const lines: string[] = []
  let problems = 0
  for (const r of reports) {
    if (!r.problems.length) {
      lines.push(`[ok]       ${r.file}`)
      continue
    }
    problems += r.problems.length
    lines.push(`[problem]  ${r.file}`)
    for (const p of r.problems) lines.push(`           - ${p}`)
  }
  lines.push(
    '',
    problems ? `${problems} problem(s) in ${reports.length} file(s).` : `${reports.length} file(s), all valid.`,
  )
  return { text: lines.join('\n'), problems }
}

// ── commands ─────────────────────────────────────────────────────────────────

export function status(): number {
  const lines = [`Workspace: ${config.workspaceFolder}`]
  if (!existsSync(config.workspaceFolder)) {
    console.log(`${lines[0]}\n(the folder does not exist yet: the app creates it on first run)`)
    return 0
  }
  const hasProfile = existsSync(path.join(config.workspaceFolder, 'profile', 'profile.json'))
  const profile = hasProfile ? checkFile('profile/profile.json')!.problems.length : 0
  lines.push(
    `Profile:   ${!hasProfile ? 'missing (the app creates it on first run)' : profile ? `${profile} problem(s)` : 'ok'}`,
    '',
  )
  const applications = readApplications()
  lines.push(`Applications (${applications.length}):`)
  for (const a of applications) {
    lines.push(
      a.application
        ? `  ${a.application.status.padEnd(13)} ${a.slug} — ${a.application.company}, ${a.application.role}`
        : `  ${'INVALID'.padEnd(13)} ${a.slug} (${a.problems.length} problem(s): run vagas:validate -- ${a.slug})`,
    )
  }
  const broken = checkWorkspace().filter((r) => r.problems.length).length
  lines.push('', broken ? `${broken} file(s) with problems: npm run vagas:validate -- --all` : 'Every file is valid.')
  console.log(lines.join('\n'))
  return 0
}

/** A file path (relative to the workspace, or absolute inside it) or an application slug (all its files). */
function reportsFor(target: string): FileReport[] {
  const absolute = path.resolve(config.workspaceFolder, target)
  const relative = path.relative(config.workspaceFolder, absolute).replaceAll(path.sep, '/')
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Outside the workspace: ${target}`)
  if (validSlug(target) && existsSync(path.join(config.workspaceFolder, 'applications', target))) {
    return listFiles()
      .filter((f) => f.startsWith(`applications/${target}/`))
      .map(checkFile)
      .filter((r): r is FileReport => r !== null)
  }
  const report = checkFile(relative)
  if (!report) throw new Error(`Not a file the app validates: ${relative} (see shared/workspace.ts for the map).`)
  return [report]
}

export function validate(args: Args): number {
  let reports: FileReport[]
  if (args.all) reports = checkWorkspace()
  else if (args.positional.length) reports = args.positional.flatMap(reportsFor)
  else throw new Error('Say what to validate: a file, an application slug, or --all.')
  const { text, problems } = formatReports(reports)
  console.log(text)
  return problems ? 1 : 0
}

/** Writes docs/schemas/*.schema.json; with `--check`, fails when they are out of date (CI). */
export async function schemas(check: boolean): Promise<number> {
  const folder = path.join(config.root, 'docs', 'schemas')
  await mkdir(folder, { recursive: true })
  const stale: string[] = []
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    const file = path.join(folder, `${name}.schema.json`)
    const json = `${JSON.stringify(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }), null, 2)}\n`
    if (check) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== json) stale.push(`docs/schemas/${name}.schema.json`)
      continue
    }
    await writeFile(file, json)
    console.log(`docs/schemas/${name}.schema.json`)
  }
  if (stale.length) {
    console.error(`Out of date (run npm run vagas:schemas):\n  ${stale.join('\n  ')}`)
    return 1
  }
  if (check) console.log('docs/schemas is up to date.')
  return 0
}

// ── main ─────────────────────────────────────────────────────────────────────

const HELP = `Usage: npm run vagas:<command> -- [arguments] [--workspace <dir>]
  status                          the workspace: profile, applications and how many files have problems
  validate <file|slug> | --all    schemas and path rules of every workspace file
  schemas [--check]               writes docs/schemas/*.schema.json (--check: fail if out of date)`

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2)
  const args = readArgs(rest)
  if (args.workspace) config.workspaceFolder = path.resolve(args.workspace)
  switch (command) {
    case 'status':
      return status()
    case 'validate':
      return validate(args)
    case 'schemas':
      return schemas(args.check)
    default:
      console.log(HELP)
      return command ? 1 : 0
  }
}

// only runs when called as a script (the tests import the pure functions without triggering anything)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    },
  )
}
