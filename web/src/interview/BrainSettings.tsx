/** Settings: which engine runs the live interview, the Ollama model, and the API provider/model. */

import { useEffect, useState } from 'react'
import { Badge, Button, Field, Input, Select } from '@/components/ui'
import { SettingsSection } from '@/pages/Settings'
import { useT } from '@/i18n'
import { api, useData } from '@/lib/api'

type BrainInfo = {
  choice: 'auto' | 'ollama' | 'acp' | 'api'
  ollama: { ok: boolean; models: string[]; model: string | null }
  agent: string | null
  api: { provider: 'anthropic' | 'openai'; model: string; baseUrl: string; hasKey: boolean }
}

export function BrainSettings() {
  const t = useT()
  const i = t.interview
  const s = t.settings
  const info = useData<BrainInfo>('/api/brain')
  const [draft, setDraft] = useState({ apiModel: '', baseUrl: '' })
  useEffect(() => {
    if (info.data) setDraft({ apiModel: info.data.api.model, baseUrl: info.data.api.baseUrl })
  }, [info.data])
  if (!info.data) return null
  const d = info.data
  const put = async (body: object) => {
    await api.put('/api/brain', body)
    await info.reload()
  }
  return (
    <SettingsSection title={i.brain}>
      <p className="text-sm text-muted">{i.brainNote}</p>
      <Select
        value={d.choice}
        onChange={(e) => put({ choice: e.target.value })}
        aria-label={i.brain}
        className="max-w-xs"
      >
        {(['auto', 'ollama', 'acp', 'api'] as const).map((b) => (
          <option key={b} value={b}>
            {i.brains[b]}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Ollama:</span>
        {d.ollama.ok ? (
          <>
            <Badge tone="success">{s.running}</Badge>
            <Select
              value={d.ollama.model ?? ''}
              onChange={(e) => put({ ollamaModel: e.target.value || null })}
              aria-label="Ollama"
              className="w-auto py-1.5 text-sm"
            >
              {d.ollama.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <Badge>{s.notRunning}</Badge>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={s.apiProvider}>
          {(id) => (
            <Select id={id} value={d.api.provider} onChange={(e) => put({ apiProvider: e.target.value })}>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI-compatible</option>
            </Select>
          )}
        </Field>
        <Field label={s.apiModel}>
          {(id) => (
            <Input id={id} value={draft.apiModel} onChange={(e) => setDraft({ ...draft, apiModel: e.target.value })} />
          )}
        </Field>
        {d.api.provider === 'openai' && (
          <Field label={s.apiBaseUrl}>
            {(id) => (
              <Input
                id={id}
                type="url"
                placeholder="https://api.openai.com/v1"
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              />
            )}
          </Field>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          size="small"
          variant="subtle"
          onClick={() =>
            put({
              apiModel: draft.apiModel || null,
              ...(d.api.provider === 'openai' ? { openaiBaseUrl: draft.baseUrl || null } : {}),
            })
          }
        >
          {t.general.save}
        </Button>
        <span className="text-sm text-muted">{d.api.hasKey ? s.keyReady : s.keyMissing}</span>
      </div>
    </SettingsSection>
  )
}
