/**
 * Updates from GitHub Releases (electron-updater reads the `latest*.yml` the release workflow publishes).
 *
 * Windows and Linux (AppImage) update by themselves: download in the background, install on quit. macOS can only
 * auto-update a SIGNED app — and the builds are unsigned until the certificates are bought (an open decision of the
 * plan) — so on macOS the app only tells the person a new version exists, with the download link.
 */

import { dialog, shell, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

const RELEASES = 'https://github.com/pedromzn/mzn-vagas/releases/latest'

export function startUpdater(window: BrowserWindow) {
  // electron-updater is CommonJS: the documented interop for an ESM main process
  const { autoUpdater } = electronUpdater
  const signedMac = process.platform === 'darwin' && process.env.MZN_MAC_SIGNED === '1'
  const notifyOnly = process.platform === 'darwin' && !signedMac
  autoUpdater.autoDownload = !notifyOnly
  autoUpdater.autoInstallOnAppQuit = !notifyOnly
  autoUpdater.logger = null

  autoUpdater.on('update-available', async (info) => {
    if (!notifyOnly) return
    const { response } = await dialog.showMessageBox(window, {
      type: 'info',
      message: `Find Dreams ${info.version}`,
      detail: 'A new version is available. Download it from GitHub and replace the app in Applications.',
      buttons: ['Download', 'Later'],
      defaultId: 0,
    })
    if (response === 0) void shell.openExternal(RELEASES)
  })
  autoUpdater.on('error', () => {
    /* offline, rate-limited or no release yet: try again next launch */
  })
  setTimeout(() => void autoUpdater.checkForUpdates().catch(() => undefined), 10_000).unref()
}
