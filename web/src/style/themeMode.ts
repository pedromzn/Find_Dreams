/**
 * The theme: system, dark or light. Like the language, the choice is mirrored in the server's preferences (the desktop
 * app serves the page on a random port, so `localStorage` alone would forget it every launch); `localStorage` only
 * avoids a flash of the wrong theme while the settings load.
 */

import { create } from 'zustand'
import type { ThemeMode } from '@shared/api'

const KEY = 'mzn-vagas:theme'
const media = typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: light)')

function stored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply(mode: ThemeMode) {
  const light = mode === 'light' || (mode === 'system' && media?.matches === true)
  document.documentElement.dataset.theme = light ? 'light' : 'dark'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f4f5f8' : '#12141a')
}

interface ThemeState {
  mode: ThemeMode
  choose: (mode: ThemeMode) => void
}

export const useThemeMode = create<ThemeState>((set) => ({
  mode: stored(),
  choose: (mode) => {
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* private window: the choice lasts for this visit */
    }
    apply(mode)
    set({ mode })
  },
}))

apply(useThemeMode.getState().mode)
media?.addEventListener('change', () => apply(useThemeMode.getState().mode))
