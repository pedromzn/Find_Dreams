/**
 * API keys in the operating system's keychain: Electron `safeStorage` encrypts with the OS (Keychain on macOS, DPAPI on
 * Windows, the secret service on Linux) and the ciphertext lives in `userData/secrets.json`. The server's secret store
 * is swapped for this one at start (`secrets.use`).
 *
 * The crypto is injected so the store is testable without Electron.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { SecretStore } from '../server/secrets.js'

export interface Cipher {
  available(): boolean
  encrypt(plain: string): Buffer
  decrypt(cipher: Buffer): string
}

export function keychainStore(userData: string, cipher: Cipher): SecretStore {
  const file = path.join(userData, 'secrets.json')
  const load = (): Record<string, string> => {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
    } catch {
      return {}
    }
  }
  return {
    get(name) {
      const stored = load()[name]
      if (stored && cipher.available()) {
        try {
          return cipher.decrypt(Buffer.from(stored, 'base64'))
        } catch {
          return null
        }
      }
      return process.env[name] ?? null
    },
    set(name, value) {
      if (value && !cipher.available()) throw new Error('The system keychain is not available: the key was not saved.')
      const all = load()
      if (value) all[name] = cipher.encrypt(value).toString('base64')
      else delete all[name]
      writeFileSync(file, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 })
    },
    names: () => Object.keys(load()),
  }
}
