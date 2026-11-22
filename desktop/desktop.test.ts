import { mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { keychainStore } from './secrets.js'
import {
  CONTENT_SECURITY_POLICY,
  externalUrl,
  isAppUrl,
  readSettings,
  resolveWorkspace,
  writeSettings,
} from './settings.js'

const temp = () => mkdtempSync(path.join(tmpdir(), 'mzn-desktop-'))

describe('desktop settings', () => {
  it('the workspace defaults to Documents/Find Dreams and follows the choice', () => {
    const userData = temp()
    const documents = temp()
    expect(resolveWorkspace(userData, documents)).toBe(path.join(documents, 'Find Dreams'))
    expect(statSync(path.join(documents, 'Find Dreams')).isDirectory()).toBe(true)
    const chosen = path.join(temp(), 'Vagas')
    writeSettings(userData, { workspace: chosen })
    expect(readSettings(userData).workspace).toBe(chosen)
    expect(resolveWorkspace(userData, documents)).toBe(chosen)
    writeSettings(userData, { workspace: 'relative/path' })
    expect(resolveWorkspace(userData, documents)).toBe(path.join(documents, 'Find Dreams'))
  })

  it("keeps the folder of the app's old name when it already holds data", () => {
    const userData = temp()
    const documents = temp()
    mkdirSync(path.join(documents, 'MZN Vagas'))
    expect(resolveWorkspace(userData, documents)).toBe(path.join(documents, 'MZN Vagas'))
  })

  it('the CSP keeps everything on the app origin, with blob audio and no inline scripts', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'")
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self';")
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(CONTENT_SECURITY_POLICY).toContain("media-src 'self' blob:")
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'")
  })

  it('only http(s) links leave the app, and navigation stays on the origin', () => {
    expect(externalUrl('https://geminicli.com/docs')).toBe('https://geminicli.com/docs')
    expect(externalUrl('file:///etc/passwd')).toBeNull()
    expect(externalUrl('javascript:alert(1)')).toBeNull()
    expect(isAppUrl('http://127.0.0.1:5123/applications/x', 'http://127.0.0.1:5123')).toBe(true)
    expect(isAppUrl('http://127.0.0.1:9999/', 'http://127.0.0.1:5123')).toBe(false)
    expect(isAppUrl('https://evil.example', 'http://127.0.0.1:5123')).toBe(false)
  })
})

describe('the keychain store', () => {
  // a reversible fake: the real one is Electron safeStorage
  const cipher = (available = true) => ({
    available: () => available,
    encrypt: (s: string) => Buffer.from([...s].reverse().join(''), 'utf8'),
    decrypt: (b: Buffer) => [...b.toString('utf8')].reverse().join(''),
  })

  it('stores only ciphertext on disk, readable back through the cipher', () => {
    const userData = temp()
    const store = keychainStore(userData, cipher())
    store.set('ANTHROPIC_API_KEY', 'sk-ant-secret')
    expect(readFileSync(path.join(userData, 'secrets.json'), 'utf8')).not.toContain('sk-ant-secret')
    expect(store.get('ANTHROPIC_API_KEY')).toBe('sk-ant-secret')
    expect(store.names()).toEqual(['ANTHROPIC_API_KEY'])
    store.set('ANTHROPIC_API_KEY', null)
    expect(store.get('ANTHROPIC_API_KEY')).toBeNull()
  })

  it('refuses to save when the keychain is unavailable (never falls back to plain text)', () => {
    expect(() => keychainStore(temp(), cipher(false)).set('OPENAI_API_KEY', 'x')).toThrow(/keychain/)
  })
})
