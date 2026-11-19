/**
 * The preload: the only bridge between the page and the desktop. Minimal on purpose — the API token travels in the
 * page (see server/security.ts); the page only gets two desktop actions: choose another workspace folder and show it
 * in the file manager. Built as CommonJS (a sandboxed preload cannot be an ES module).
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('mznDesktop', {
  chooseWorkspace: (): Promise<string | null> => ipcRenderer.invoke('mzn:choose-workspace'),
  revealWorkspace: (): Promise<string> => ipcRenderer.invoke('mzn:reveal-workspace'),
})
