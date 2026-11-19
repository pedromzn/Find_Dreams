/**
 * The candidate's profile and CV (`profile/profile.json`, `profile/cv.md`). The most sensitive files in the workspace:
 * only the app's own forms write them, and the AI is told never to touch them unless the person asks.
 */

import { readFileSync } from 'node:fs'
import type { ProfileData } from '../../shared/api.js'
import { profileSchema, type Profile } from '../../shared/profile.js'
import { validateFile } from '../../shared/workspace.js'
import { workspacePath, writeFileAtomic } from './workspace.js'

const read = (relative: string) => {
  try {
    return readFileSync(workspacePath(relative), 'utf8')
  } catch {
    return null
  }
}

export function readProfile(): ProfileData {
  const raw = read('profile/profile.json')
  const cv = read('profile/cv.md')
  if (raw === null) return { profile: null, problems: [], cv }
  const problems = validateFile('profile/profile.json', raw) ?? []
  return { profile: problems.length ? null : profileSchema.parse(JSON.parse(raw)), problems, cv }
}

export function hasProfile(): boolean {
  return read('profile/profile.json') !== null
}

export function writeProfile(input: unknown): Profile {
  const profile = profileSchema.parse(input)
  writeFileAtomic(workspacePath('profile', 'profile.json'), `${JSON.stringify(profile, null, 2)}\n`)
  return profile
}

export function writeCv(markdown: string): void {
  writeFileAtomic(workspacePath('profile', 'cv.md'), `${markdown.trim()}\n`)
}
