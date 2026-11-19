/** Settings: interface language, workspace folder and the privacy note. Agent, brain and voice join in later phases. */

import type { ReactNode } from 'react'
import { FolderSimple, ShieldCheck } from '@phosphor-icons/react'
import type { Settings as SettingsData } from '@shared/api'
import { LANGUAGE_DATA, LANGUAGES, type Language } from '@shared/languages'
import { Header, Loading, Panel, ScreenError, Select } from '@/components/ui'
import { useLanguage, useT } from '@/i18n'
import { useData } from '@/lib/api'

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="flex flex-col gap-3 p-6">
      <h2 className="text-xl">{title}</h2>
      {children}
    </Panel>
  )
}

export default function Settings({ extra }: { extra?: ReactNode }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const choose = useLanguage((s) => s.choose)
  const data = useData<SettingsData>('/api/settings')
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
      <SettingsSection title={t.settings.workspace}>
        <p className="flex items-center gap-2 rounded-tile border border-border bg-bg px-4 py-3 font-mono text-sm break-all text-text">
          <FolderSimple size={18} className="shrink-0 text-accent-text" aria-hidden />
          {data.data.workspaceFolder}
        </p>
        <p className="text-sm text-muted">{t.settings.workspaceNote}</p>
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
