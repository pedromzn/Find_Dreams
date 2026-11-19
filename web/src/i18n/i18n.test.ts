/**
 * The type system already forces `pt-BR` to have the keys of `en`; this also catches the `errors` map (typed as a
 * plain record, so the compiler cannot see a missing code) and a text that became a function in one language only.
 */

import { describe, expect, it } from 'vitest'
import { en } from './en'
import { ptBR } from './pt-BR'

function shape(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => shape(v, `${prefix}${key}.`))
  }
  return [`${prefix.slice(0, -1)}:${typeof value}`]
}

describe('dictionaries', () => {
  it('pt-BR has exactly the keys (and kinds) of en', () => {
    expect(shape(ptBR).sort()).toEqual(shape(en).sort())
  })

  it('no text is empty', () => {
    for (const entry of shape(ptBR)) expect(entry).not.toMatch(/:undefined$/)
    expect(JSON.stringify(ptBR)).not.toMatch(/""/)
  })
})
