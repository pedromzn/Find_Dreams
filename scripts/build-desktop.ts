/**
 * Compiles the desktop app: the Electron main process with the whole server bundled in (ESM), and the preload
 * (CommonJS: a sandboxed preload cannot be an ES module). No `tsx` in the packaged app. Dependencies stay external:
 * electron-builder packs the production `node_modules` (the server's runtime only — the web app's libraries are dev
 * dependencies, compiled into `dist/` by Vite).
 *
 *   npm run desktop:compile
 */

import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [path.join(root, 'desktop', 'main.ts')],
  outfile: path.join(root, 'dist-desktop', 'main.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
})

await build({
  entryPoints: [path.join(root, 'desktop', 'preload.ts')],
  outfile: path.join(root, 'dist-desktop', 'preload.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
  logLevel: 'info',
})
