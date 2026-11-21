/**
 * The first run, after the language: the workspace folder, the CV (optional) and the profile. The agent and the voice
 * are offered later, from their own screens — the app is already useful as a tracker without them.
 */

import { useState } from 'react'
import { FolderSimple } from '@phosphor-icons/react'
import type { ProfileData, Settings } from '@shared/api'
import { Brand } from '@/components/Brand'
import { Button, Loading, Panel, join } from '@/components/ui'
import { useT } from '@/i18n'
import { useData } from '@/lib/api'
import { CvEditor, ProfileForm } from '@/profile/ProfileForm'

type Step = 'workspace' | 'cv' | 'profile'
const STEPS: Step[] = ['workspace', 'cv', 'profile']

export default function Welcome({ onDone }: { onDone: () => void }) {
  const t = useT()
  const w = t.welcome
  const settings = useData<Settings>('/api/settings')
  const profile = useData<ProfileData>('/api/profile')
  const [step, setStep] = useState<Step>('workspace')
  const labels: Record<Step, string> = { workspace: w.stepWorkspace, cv: w.stepCv, profile: w.stepProfile }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center gap-3">
        <Brand size={44} />
        <h1 className="text-3xl">{w.title}</h1>
      </div>
      <p className="text-muted">{w.note}</p>
      <ol className="flex gap-2" aria-label={w.title}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={s === step ? 'step' : undefined}
            className={join(
              'flex-1 rounded-pill border px-3 py-1.5 text-center text-sm',
              s === step ? 'border-accent text-text' : 'border-border text-faint',
            )}
          >
            {i + 1}. {labels[s]}
          </li>
        ))}
      </ol>

      {!settings.data || !profile.data ? (
        <Loading />
      ) : step === 'workspace' ? (
        <Panel className="flex flex-col gap-4 p-6">
          <h2 className="text-xl">{w.workspaceTitle}</h2>
          <p className="flex items-center gap-2 rounded-tile border border-border bg-bg px-4 py-3 font-mono text-sm break-all text-text">
            <FolderSimple size={18} className="shrink-0 text-accent-text" aria-hidden />
            {settings.data.workspaceFolder}
          </p>
          <p className="text-muted">{w.workspaceNote}</p>
          <Button className="self-end" onClick={() => setStep('cv')}>
            {t.general.next}
          </Button>
        </Panel>
      ) : step === 'cv' ? (
        <Panel className="flex flex-col gap-4 p-6">
          <h2 className="text-xl">{w.cvTitle}</h2>
          <p className="text-muted">{w.cvNote}</p>
          <CvEditor cv={profile.data.cv} onSaved={() => setStep('profile')} submitLabel={t.general.next} />
          <Button variant="ghost" className="self-end" onClick={() => setStep('profile')}>
            {t.general.skip}
          </Button>
        </Panel>
      ) : (
        <Panel className="flex flex-col gap-4 p-6">
          <h2 className="text-xl">{w.profileTitle}</h2>
          <ProfileForm profile={profile.data.profile} onSaved={onDone} submitLabel={w.finish} />
        </Panel>
      )}
    </div>
  )
}
