/**
 * API keys (Anthropic, OpenAI…): never in a text file. The desktop app plugs in a store backed by the operating
 * system's keychain (Electron `safeStorage`, `desktop/secrets.ts`); in dev (browser) keys live only in this process's
 * memory, or come from the environment (`ANTHROPIC_API_KEY=… npm run dev`). The page can set and clear a key and ask
 * whether one is set; it can never read it back.
 */

export interface SecretStore {
  get(name: string): string | null
  set(name: string, value: string | null): void
  names(): string[]
}

const memory = new Map<string, string>()

const memoryStore: SecretStore = {
  get: (name) => memory.get(name) ?? process.env[name] ?? null,
  set: (name, value) => {
    if (value) memory.set(name, value)
    else memory.delete(name)
  },
  names: () => [...new Set([...memory.keys(), ...KNOWN_SECRETS.filter((n) => process.env[n])])],
}

export const KNOWN_SECRETS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const

let store: SecretStore = memoryStore

export const secrets = {
  get: (name: string) => store.get(name),
  set: (name: string, value: string | null) => store.set(name, value),
  has: (name: string) => Boolean(store.get(name)),
  /** the desktop main process calls this with the keychain-backed store */
  use: (next: SecretStore) => {
    store = next
  },
}
