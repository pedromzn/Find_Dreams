/**
 * Finding the person's tools. A GUI app on macOS or Linux does not inherit the PATH of the person's shell (it gets
 * launchd's `/usr/bin:/bin:…`), so `claude`, `codex`, `gemini`, `ollama`, `uv` installed through npm, Homebrew, nvm or
 * pipx are invisible. We ask the login shell once for its PATH and merge it with ours. Windows GUI apps get the full
 * user PATH already.
 */

import { execFile } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const MARK = '__MZN_PATH__'

/** Common install folders, as a fallback when the shell cannot be asked (or is slow). */
function wellKnown(): string[] {
  const home = homedir()
  return [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.local', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.bun', 'bin'),
    path.join(home, '.cargo', 'bin'),
    path.join(home, '.opencode', 'bin'),
  ]
}

function askShell(): Promise<string> {
  const shell = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
  return new Promise((resolve) => {
    execFile(
      shell,
      ['-ilc', `printf '${MARK}%s${MARK}' "$PATH"`],
      { timeout: 4000, env: { ...process.env, DISABLE_AUTO_UPDATE: 'true' } },
      (error, stdout) => {
        if (error) return resolve('')
        const m = new RegExp(`${MARK}(.*)${MARK}`).exec(stdout)
        resolve(m?.[1] ?? '')
      },
    )
  })
}

let cached: Promise<string> | null = null

/** The merged PATH (shell first, then ours, then well-known folders), computed once per process. */
export function shellPath(): Promise<string> {
  cached ??= (async () => {
    const ours = process.env.PATH ?? ''
    if (process.platform === 'win32') return ours
    const fromShell = await askShell()
    const parts = [...fromShell.split(':'), ...ours.split(':'), ...wellKnown()].filter(Boolean)
    return [...new Set(parts)].join(':')
  })()
  return cached
}

/** The environment for a child process: ours, with the merged PATH. */
export async function childEnv(extra: Record<string, string> = {}): Promise<NodeJS.ProcessEnv> {
  return { ...process.env, PATH: await shellPath(), ...extra }
}

/** The absolute path of an executable on the merged PATH, or null. */
export async function which(binary: string): Promise<string | null> {
  const dirs = (await shellPath()).split(path.delimiter)
  const extensions = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : ['']
  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir, binary + ext.toLowerCase())
      try {
        if (!statSync(candidate).isFile()) continue
        if (process.platform !== 'win32') accessSync(candidate, constants.X_OK)
        return candidate
      } catch {
        /* not here */
      }
    }
  }
  return null
}

/** Tests replace the cache (a fixed PATH, no shell). */
export function setShellPathForTests(value: string | null) {
  cached = value === null ? null : Promise.resolve(value)
}
