/**
 * Every text/background pair the app uses must pass WCAG AA (4.5:1 for text, 3:1 for UI shapes like the red button
 * against the page). Reads the real values from `theme.css`, so changing a color there re-checks it here.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'theme.css'), 'utf8')
const root = css.slice(css.indexOf(':root {'))
const tokens = Object.fromEntries([...root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]))

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const TEXT_ON = ['bg', 'surface', 'surface-2']
const TEXTS = ['text', 'muted', 'faint', 'accent-text', 'danger', 'success', 'warning']

describe('theme contrast (WCAG AA)', () => {
  it('reads the tokens from theme.css', () => {
    for (const name of [...TEXT_ON, ...TEXTS, 'accent', 'accent-hover', 'on-accent']) expect(tokens[name]).toBeDefined()
  })

  for (const text of TEXTS) {
    for (const background of TEXT_ON) {
      it(`${text} on ${background} ≥ 4.5`, () => {
        expect(contrast(tokens[text]!, tokens[background]!)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('white text on the red button (normal and hover) ≥ 4.5', () => {
    expect(contrast(tokens['on-accent']!, tokens.accent!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens['on-accent']!, tokens['accent-hover']!)).toBeGreaterThanOrEqual(4.5)
  })

  it('the red button stands out from the page ≥ 3', () => {
    expect(contrast(tokens.accent!, tokens.bg!)).toBeGreaterThanOrEqual(3)
  })
})
