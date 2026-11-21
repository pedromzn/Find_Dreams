/**
 * The buttons that hand a task to the person's AI. Each one writes a request (`requests/<id>.json`) and shows the
 * short prompt to paste into any AI CLI opened in the workspace. When an agent is connected (phase 4), the same
 * request runs right here, with the output streaming in.
 */

import { useState } from 'react'
import { Buildings, ChatCircleText, Microphone, Target, Wrench } from '@phosphor-icons/react'
import type { CreatedRequest } from '@shared/api'
import type { InterviewType } from '@shared/interviewTypes'
import type { Task } from '@shared/request'
import type { Language } from '@shared/languages'
import { Button, Command, ErrorLine } from '@/components/ui'
import { Dialog } from '@/components/Dialog'
import { useLanguage, useT } from '@/i18n'
import { api } from '@/lib/api'
import { RunWithAgent } from './RunWithAgent'

export type AgentTask = 'analyze-fit' | 'research-company' | 'interviews' | 'fix-files'

/** Creates the request and opens the hand-off dialog (copy the prompt, or run with the connected agent). */
export function useHandOff(onDone: () => void) {
  const language = useLanguage((s) => s.language)
  const [created, setCreated] = useState<CreatedRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function start(
    task: Task,
    extra: {
      application?: string
      file?: string
      interviewType?: InterviewType
      details?: string
      /** the language the AI writes in, when it is not the interface's (a résumé translation) */
      language?: Language
    },
  ) {
    setBusy(true)
    setError(null)
    try {
      setCreated(await api.post<CreatedRequest>('/api/requests', { task, language, ...extra }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dialog = (
    <HandOffDialog
      created={created}
      onClose={() => {
        setCreated(null)
        onDone()
      }}
    />
  )
  return { start, busy, error, dialog }
}

export function HandOffDialog({ created, onClose }: { created: CreatedRequest | null; onClose: () => void }) {
  const t = useT()
  return (
    <Dialog open={created !== null} onClose={onClose} title={created ? t.agent.tasks[created.request.task] : ''}>
      {created && (
        <>
          <RunWithAgent request={created.request} onFinished={onClose} />
          <p className="text-sm text-muted">{t.agent.copyNote}</p>
          <Command label={t.agent.folder} text={created.folder} />
          <Command label={t.agent.prompt} text={created.prompt} />
          <p className="text-xs text-faint">{t.agent.requestSaved(created.request.id)}</p>
        </>
      )}
    </Dialog>
  )
}

export function AgentActions({ slug, only, onDone }: { slug: string; only: AgentTask[]; onDone: () => void }) {
  const t = useT()
  const { start, busy, error, dialog } = useHandOff(onDone)
  const buttons: Record<AgentTask, { label: string; icon: React.ReactNode; task: Task }> = {
    'analyze-fit': { label: t.agent.analyzeFit, icon: <Target size={18} />, task: 'analyze-fit' },
    'research-company': { label: t.agent.researchCompany, icon: <Buildings size={18} />, task: 'research-company' },
    interviews: { label: t.agent.prepareInterview, icon: <Microphone size={18} />, task: 'prepare-interview' },
    'fix-files': { label: t.agent.fixFiles, icon: <Wrench size={18} />, task: 'fix-files' },
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        {only.map((key) => (
          <Button
            key={key}
            variant="subtle"
            icon={buttons[key].icon}
            disabled={busy}
            onClick={() => start(buttons[key].task, { application: slug })}
          >
            {buttons[key].label}
          </Button>
        ))}
      </div>
      <ErrorLine message={error} />
      {dialog}
    </div>
  )
}

export function MessageActions({ slug, message, onDone }: { slug: string; message: string; onDone: () => void }) {
  const t = useT()
  const { start, busy, error, dialog } = useHandOff(onDone)
  return (
    <div className="mt-3 flex flex-col gap-2">
      <Button
        variant="subtle"
        size="small"
        className="self-start"
        icon={<ChatCircleText size={16} />}
        disabled={busy}
        onClick={() => start('reply-recruiter', { application: slug, file: `messages/${message}` })}
      >
        {t.agent.draftReplies}
      </Button>
      <ErrorLine message={error} />
      {dialog}
    </div>
  )
}

/** One button for any task, with its own hand-off dialog: the v2 screens' way to ask the AI for something. */
export function AiButton({
  task,
  application,
  file,
  details,
  language,
  label,
  icon,
  variant = 'subtle',
  size = 'normal',
  onDone,
  className,
}: {
  task: Task
  application?: string
  file?: string
  details?: string
  language?: Language
  label: string
  icon?: React.ReactNode
  variant?: 'main' | 'subtle' | 'ghost'
  size?: 'normal' | 'small'
  onDone?: () => void
  className?: string
}) {
  const { start, busy, error, dialog } = useHandOff(onDone ?? (() => undefined))
  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        disabled={busy}
        className={className}
        onClick={() =>
          start(task, {
            ...(application ? { application } : {}),
            ...(file ? { file } : {}),
            ...(details ? { details } : {}),
            ...(language ? { language } : {}),
          })
        }
      >
        {label}
      </Button>
      <ErrorLine message={error} />
      {dialog}
    </>
  )
}
