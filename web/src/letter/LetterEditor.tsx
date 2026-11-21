/**
 * The cover letter of one application: written by the AI in the chosen tone, shown on paper, editable in place,
 * copied or exported as PDF. Edits are saved back to `cover-letter.md` (its front matter kept valid by the server).
 */

import { useState } from 'react'
import { ArrowsClockwise, Check, Copy, MagnifyingGlass, NotePencil, PencilSimple, Printer } from '@phosphor-icons/react'
import type { ApplicationDetail } from '@shared/api'
import { LETTER_TONES, readFrontMatter, type LetterTone } from '@shared/workspace'
import type { Language } from '@shared/languages'
import { Badge, Button, Empty, ErrorLine, Field, Input, Problems, Segmented, TextArea } from '@/components/ui'
import { useLanguage, useT } from '@/i18n'
import { api } from '@/lib/api'
import { AiButton } from '@/agent/AgentActions'

function parse(detail: ApplicationDetail): { body: string; tone: LetterTone; language: Language | null } | null {
  if (!detail.letter) return null
  const front = readFrontMatter(detail.letter.content)
  const tone = (LETTER_TONES as readonly string[]).includes(front?.data.tone ?? '')
    ? (front!.data.tone as LetterTone)
    : 'direct'
  const language = front?.data.language === 'en' || front?.data.language === 'pt-BR' ? front.data.language : null
  return { body: (front?.body ?? detail.letter.content).trim(), tone, language }
}

export function LetterEditor({ detail, reload }: { detail: ApplicationDetail; reload: () => void }) {
  const t = useT()
  const interfaceLanguage = useLanguage((s) => s.language)
  const letter = parse(detail)
  const [tone, setTone] = useState<LetterTone>(letter?.tone ?? 'direct')
  const [extra, setExtra] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const details = `tone: ${tone}${extra.trim() ? `. ${extra.trim()}` : ''}`

  const toneControl = (
    <Segmented
      label={t.letters.tone}
      value={tone}
      onChange={setTone}
      size="small"
      options={LETTER_TONES.map((id) => ({ id, label: t.letters.tones[id] }))}
    />
  )

  if (!letter) {
    return (
      <Empty icon={<NotePencil size={26} />} title={t.letters.none}>
        <p>{t.letters.noneNote}</p>
        <div className="mt-5 flex flex-col items-center gap-3 text-left">
          {toneControl}
          <Field label={t.letters.extra} className="w-full max-w-md">
            {(id) => (
              <Input
                id={id}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder={t.letters.extraPlaceholder}
              />
            )}
          </Field>
          <AiButton
            task="cover-letter"
            application={detail.slug}
            details={details}
            variant="main"
            icon={<NotePencil size={18} />}
            label={t.letters.write}
            onDone={reload}
          />
        </div>
      </Empty>
    )
  }

  const words = letter.body.split(/\s+/).filter(Boolean).length

  async function save() {
    if (editing === null) return
    setError(null)
    try {
      await api.put(`/api/applications/${detail.slug}/letter`, {
        body: editing,
        tone: letter!.tone,
        language: letter!.language ?? interfaceLanguage,
      })
      setEditing(null)
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter!.body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* no clipboard permission */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Problems problems={detail.letter!.problems} file="cover-letter.md" />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{t.letters.tones[letter.tone]}</Badge>
        <span className="text-[13px] text-faint">{t.letters.words(words)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {editing === null ? (
            <>
              <Button
                variant="subtle"
                size="small"
                icon={<PencilSimple size={16} />}
                onClick={() => setEditing(letter.body)}
              >
                {t.general.edit}
              </Button>
              <Button
                variant="subtle"
                size="small"
                icon={copied ? <Check size={16} /> : <Copy size={16} />}
                onClick={copy}
              >
                {copied ? t.general.copied : t.general.copy}
              </Button>
              <Button variant="subtle" size="small" icon={<Printer size={16} />} onClick={() => window.print()}>
                {t.resume.print}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="small" onClick={() => setEditing(null)}>
                {t.general.cancel}
              </Button>
              <Button size="small" onClick={save}>
                {t.general.save}
              </Button>
            </>
          )}
        </div>
      </div>
      <ErrorLine message={error} />
      {editing !== null ? (
        <TextArea
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          className="min-h-[520px] font-[inherit] leading-7"
          aria-label={t.application.tabs.letter}
        />
      ) : (
        <div className="print-area flex justify-center">
          <article className="sheet min-h-0 px-14 py-12 text-[14px] leading-[1.7]" lang={letter.language ?? undefined}>
            {letter.body.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="mb-4 whitespace-pre-line last:mb-0">
                {p}
              </p>
            ))}
          </article>
        </div>
      )}
      {editing === null && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {toneControl}
          <AiButton
            task="cover-letter"
            application={detail.slug}
            details={details}
            size="small"
            icon={<ArrowsClockwise size={16} />}
            label={t.letters.rewrite}
            onDone={reload}
          />
          <AiButton
            task="cover-letter"
            application={detail.slug}
            details={`review. tone: ${letter.tone}`}
            size="small"
            variant="ghost"
            icon={<MagnifyingGlass size={16} />}
            label={t.letters.review}
            onDone={reload}
          />
        </div>
      )}
    </div>
  )
}
