/** Settings: interface language, workspace folder and the privacy note. Agent, brain and voice join in later phases. */

import type { ReactNode } from 'react'
import { Desktop, FolderSimple, Moon, ShieldCheck, Sun } from '@phosphor-icons/react'
import { THEME_MODES, type Settings as SettingsData, type ThemeMode } from '@shared/api'
import { LANGUAGE_DATA, LANGUAGES, type Language } from '@shared/languages'
import { Button, Header, Loading, Panel, ScreenError, Segmented, Select } from '@/components/ui'
import { useLanguage, useT } from '@/i18n'
import { api, useData } from '@/lib/api'
import { useThemeMode } from '@/style/themeMode'

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="flex flex-col gap-3 p-6">
      <h2 className="text-lg">{title}</h2>
      {children}
    </Panel>
  )
}

/** Only in the desktop app (the preload exposes it). */
const desktop = (
  window as unknown as {
    mznDesktop?: { chooseWorkspace(): Promise<string | null>; revealWorkspace(): Promise<string> }
  }
).mznDesktop

export default function Settings({ extra }: { extra?: ReactNode }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const choose = useLanguage((s) => s.choose)
  const data = useData<SettingsData>('/api/settings')
  const theme = useThemeMode((s) => s.mode)
  const chooseTheme = useThemeMode((s) => s.choose)
  const setTheme = (mode: ThemeMode) => {
    chooseTheme(mode)
    void api.put('/api/settings', { theme: mode }).catch(() => undefined)
  }
  const themeIcon = { system: <Desktop size={16} />, dark: <Moon size={16} />, light: <Sun size={16} /> }
  if (data.error) return <ScreenError error={data.error} onRetry={data.reload} />
  if (!data.data) return <Loading />
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Header title={t.settings.title} />
      <SettingsSection title={t.settings.language}>
        <Select
          value={language}
          onChange={(e) => choose(e.target.value as Language)}
          aria-label={t.settings.language}
          className="max-w-xs"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_DATA[l].name}
            </option>
          ))}
        </Select>
      </SettingsSection>
      <SettingsSection title={t.settings.theme}>
        <div>
          <Segmented
            label={t.settings.theme}
            value={theme}
            onChange={setTheme}
            options={THEME_MODES.map((id) => ({ id, label: t.settings.themes[id], icon: themeIcon[id] }))}
          />
        </div>
      </SettingsSection>
      <SettingsSection title={t.settings.workspace}>
        <p className="flex items-center gap-2 rounded-tile border border-border bg-bg px-4 py-3 font-mono text-sm break-all text-text">
          <FolderSimple size={18} className="shrink-0 text-accent-text" aria-hidden />
          {data.data.workspaceFolder}
        </p>
        <p className="text-sm text-muted">{t.settings.workspaceNote}</p>
        {desktop && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="small" variant="subtle" onClick={() => void desktop.chooseWorkspace()}>
              {t.settings.chooseFolder}
            </Button>
            <Button size="small" variant="ghost" onClick={() => void desktop.revealWorkspace()}>
              {t.settings.revealFolder}
            </Button>
            <p className="w-full text-xs text-faint">{t.settings.chooseFolderNote}</p>
          </div>
        )}
      </SettingsSection>
      {extra}
      <SettingsSection title={t.settings.privacy}>
        <p className="flex items-start gap-2 text-muted">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-success" aria-hidden />
          {t.settings.privacyNote}
        </p>
      </SettingsSection>
    </div>
  )
}
