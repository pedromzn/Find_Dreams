/**
 * The Find Dreams desktop app (Electron main process). It runs the SAME server as `npm start` — `createApp()` — on
 * 127.0.0.1 with a random port and a per-launch API token, and opens a hardened window on it:
 * contextIsolation, no Node in the page, sandbox, a minimal preload, a CSP, external links in the system browser,
 * only the microphone (voice interviews) and clipboard-read permissions, and only for the app's own origin.
 *
 * Paths: the workspace (the person's data) defaults to `~/Documents/Find Dreams`; the app's own state, the voice
 * engines and the keychain-encrypted keys live in `userData`; the agent kit and the voice scripts ship as extra
 * resources (they must be real files: Python cannot read inside the asar archive).
 */

import { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'
import {
  CONTENT_SECURITY_POLICY,
  externalUrl,
  isAppUrl,
  resolveWorkspace,
  writeSettings,
  readSettings,
} from './settings.js'
import { keychainStore } from './secrets.js'
import { startUpdater } from './updater.js'

/**
 * What the app's own page may ask for: the microphone (voice interviews) and reading the clipboard (the "paste from
 * the clipboard" button of a new application, which reads only when the person clicks it).
 */
const ALLOWED_PERMISSIONS = new Set(['media', 'clipboard-read'])

const here = path.dirname(fileURLToPath(import.meta.url))
const resources = app.isPackaged ? process.resourcesPath : path.resolve(here, '..')
/** The app icon while developing (`electron .` would otherwise show Electron's own in the Dock and taskbar). */
const devIcon = path.resolve(here, '..', 'build', 'icon.png')
if (!app.isPackaged && process.platform === 'darwin') void app.whenReady().then(() => app.dock?.setIcon(devIcon))
// MZN_USER_DATA: a separate profile for development and smoke tests (the real one stays untouched)
if (process.env.MZN_USER_DATA) app.setPath('userData', process.env.MZN_USER_DATA)
const userData = app.getPath('userData')

// one instance: a second launch focuses the first window (two servers on one workspace would race)
if (!app.requestSingleInstanceLock()) app.quit()

/** Everything the server reads at import time must be set before it is imported. */
function prepareEnvironment() {
  process.env.NODE_ENV = 'production'
  process.env.MZN_WORKSPACE = resolveWorkspace(userData, app.getPath('documents'))
  process.env.MZN_DATA = userData
  process.env.MZN_AGENT_KIT = path.join(resources, 'agent-kit')
  process.env.MZN_VOICE_SCRIPTS = path.join(resources, 'voice')
  process.env.HOST = '127.0.0.1'
}

let window: BrowserWindow | null = null

async function start() {
  prepareEnvironment()
  const { secrets } = await import('../server/secrets.js')
  secrets.use(
    keychainStore(userData, {
      available: () => safeStorage.isEncryptionAvailable(),
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (cipher) => safeStorage.decryptString(cipher),
    }),
  )
  const { createApp, startServices } = await import('../server/main.js')
  const server = (await createApp()).listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const port = (server.address() as AddressInfo).port
  const stopServices = startServices(port)
  const origin = `http://127.0.0.1:${port}`

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CONTENT_SECURITY_POLICY] } })
  })
  session.defaultSession.setPermissionRequestHandler((contents, permission, allow, details) => {
    const fromApp = isAppUrl(details.requestingUrl ?? contents.getURL(), origin)
    allow(fromApp && ALLOWED_PERMISSIONS.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler(
    (_contents, permission, requestingOrigin) => requestingOrigin === origin && ALLOWED_PERMISSIONS.has(permission),
  )

  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#12141a',
    title: 'Find Dreams',
    // packaged builds take the icon from the installer; in development, Windows and Linux need it here
    ...(app.isPackaged ? {} : { icon: devIcon }),
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: true,
    },
  })
  window.once('ready-to-show', () => window?.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    const safe = externalUrl(url)
    if (safe) void shell.openExternal(safe)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, origin)) return
    event.preventDefault()
    const safe = externalUrl(url)
    if (safe) void shell.openExternal(safe)
  })
  await window.loadURL(origin)

  app.on('before-quit', () => {
    stopServices()
    server.close()
  })
  startUpdater(window)
}

ipcMain.handle('mzn:choose-workspace', async () => {
  const result = await dialog.showOpenDialog(window!, {
    title: 'Find Dreams',
    defaultPath: readSettings(userData).workspace ?? app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  writeSettings(userData, { ...readSettings(userData), workspace: result.filePaths[0] })
  // the server, the database and the watcher all hang on the workspace: a clean restart is the simple, safe way
  app.relaunch()
  app.exit(0)
  return result.filePaths[0]
})

ipcMain.handle('mzn:reveal-workspace', () => shell.openPath(process.env.MZN_WORKSPACE ?? ''))

app.on('second-instance', () => {
  if (window?.isMinimized()) window.restore()
  window?.focus()
})
app.on('window-all-closed', () => app.quit())
app.whenReady().then(start, (error) => {
  dialog.showErrorBox('Find Dreams', String(error))
  app.exit(1)
})
