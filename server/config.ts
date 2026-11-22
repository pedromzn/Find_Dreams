/**
 * The server configuration, all through environment variables (with a `.env` at the root, if there is one). No dotenv:
 * Node reads the file on its own.
 *
 * Unlike the sibling projects, the person's data does NOT live in the repository: it lives in a **workspace folder**
 * the person picks (`~/Documents/Find Dreams` in the desktop app). In dev it defaults to `./workspace`, which git
 * ignores. The desktop main process sets `MZN_WORKSPACE` (or changes `config` directly) before calling `createApp()`.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  /* no .env: the defaults apply */
}

export const config = {
  port: Number(process.env.PORT) || 3060,
  host: process.env.HOST || '127.0.0.1',
  production: process.env.NODE_ENV === 'production',
  root,
  /** the person's data: profile, applications, interviews (the AI reads and writes here) */
  workspaceFolder: path.resolve(root, process.env.MZN_WORKSPACE || 'workspace'),
  /** the manual and skills copied into the workspace for the person's AI (packaged as an extra resource) */
  agentKitFolder: path.resolve(root, process.env.MZN_AGENT_KIT || 'agent-kit'),
  /** what the app installs or caches outside the workspace: the voice engines (~1 GB). The desktop app passes userData. */
  dataFolder: path.resolve(root, process.env.MZN_DATA || '.data'),
  /** the Python workers (packaged as an extra resource) */
  voiceScripts: path.resolve(root, process.env.MZN_VOICE_SCRIPTS || 'voice'),
}
