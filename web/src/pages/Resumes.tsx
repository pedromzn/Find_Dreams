/**
 * Résumés: the base résumé (built from the CV), its translations and one tailored version per application. The list
 * on the left, the page in its template in the middle, and — for a tailored version — the ATS check and what changed.
 */

import { useSearchParams } from 'react-router-dom'
import { ArrowsClockwise, FileText, MagicWand, Translate, UserCircle } from '@phosphor-icons/react'
import type { ApplicationDetail, ResumeFile } from '@shared/api'
import { LANGUAGE_DATA, LANGUAGES } from '@shared/languages'
import { Empty, Header, LinkButton, Loading, Panel, Problems, ScoreRing, ScreenError, join } from '@/components/ui'
import { useT } from '@/i18n'
import { useData } from '@/lib/api'
import { useAnyFileReload } from '@/lib/events'
import { useOverview } from '@/lib/overview'
import { AiButton } from '@/agent/AgentActions'
import { AtsPanel, ResumeDocument, TailoringChanges } from '@/resume/Studio'
import { CompanyTile } from '@/pages/Board'

function ListItem({
  active,
  onClick,
  title,
  note,
  aside,
  icon,
}: {
  active: boolean
  onClick: () => void
  title: string
  note?: string
  aside?: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={join(
        'flex w-full items-center gap-3 rounded-tile px-3 py-2.5 text-left transition-colors',
        active ? 'bg-surface-3' : 'hover:bg-surface-2',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-text">{title}</span>
        {note && <span className="block truncate text-[12.5px] text-faint">{note}</span>}
      </span>
      {aside}
    </button>
  )
}

export function TailoredPreview({ slug }: { slug: string }) {
  const t = useT()
  const detail = useData<ApplicationDetail>(`/api/applications/${slug}`)
  if (detail.error) return <ScreenError error={detail.error} onRetry={detail.reload} />
  if (!detail.data) return <Loading />
  const d = detail.data
  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Problems problems={d.resumeProblems} file={`applications/${slug}/resume.json`} />
        {d.resume ? (
          <>
            <ResumeDocument file={`applications/${slug}/resume.json`} resume={d.resume} onChanged={detail.reload} />
          </>
        ) : (
          <Empty icon={<MagicWand size={26} />} title={t.resume.noTailored}>
            <p>{t.resume.noTailoredNote}</p>
            <div className="mt-4 flex justify-center">
              <AiButton
                task="tailor-resume"
                application={slug}
                variant="main"
                icon={<MagicWand size={18} />}
                label={t.resume.tailor}
                onDone={detail.reload}
              />
            </div>
          </Empty>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <AtsPanel slug={slug} />
        {d.resume && <TailoringChanges resume={d.resume} />}
        {d.resume && (
          <div className="flex flex-wrap gap-2">
            <AiButton
              task="tailor-resume"
              application={slug}
              size="small"
              icon={<ArrowsClockwise size={16} />}
              label={t.resume.retailor}
              onDone={detail.reload}
            />
            <LinkButton to={`/applications/${slug}`} variant="ghost" size="small">
              {t.resume.open}
            </LinkButton>
          </div>
        )}
      </div>
    </div>
  )
}

function BasePreview({ file, isBase, onChanged }: { file: ResumeFile; isBase: boolean; onChanged: () => void }) {
  const t = useT()
  const other = file.resume ? LANGUAGES.find((l) => l !== file.resume!.language) : undefined
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Problems problems={file.problems} file={`profile/${file.name}`} />
      {file.resume && (
        <>
          <ResumeDocument
            file={`profile/${file.name}`}
            resume={file.resume}
            onChanged={onChanged}
            extra={
              <div className="flex flex-wrap gap-2">
                <AiButton
                  task="tailor-resume"
                  size="small"
                  language={file.resume.language}
                  icon={<ArrowsClockwise size={16} />}
                  label={t.resume.rebuild}
                  onDone={onChanged}
                />
                {isBase && other && (
                  <AiButton
                    task="tailor-resume"
                    size="small"
                    language={other}
                    icon={<Translate size={16} />}
                    label={t.resume.translate(LANGUAGE_DATA[other].name)}
                    onDone={onChanged}
                  />
                )}
              </div>
            }
          />
        </>
      )}
    </div>
  )
}

export default function Resumes() {
  const t = useT()
  const resumes = useData<ResumeFile[]>('/api/resumes')
  const overview = useOverview()
  useAnyFileReload(resumes.reload)
  const [params, setParams] = useSearchParams()

  if (resumes.error) return <ScreenError error={resumes.error} onRetry={resumes.reload} />
  if (overview.error) return <ScreenError error={overview.error} onRetry={overview.reload} />
  if (!resumes.data || !overview.data) return <Loading />

  // the base is resume.json; without it, the first résumé in profile/ stands in (an AI may have named it
  // resume.<language>.json), so the screen never says "no résumé" while showing one
  const base = resumes.data.find((r) => r.name === 'resume.json') ?? resumes.data[0]
  const translations = resumes.data.filter((r) => r !== base)
  const apps = overview.data.applications
  const selected = params.get('show') ?? (base ? `profile:${base.name}` : apps[0] ? `app:${apps[0].slug}` : '')
  const select = (value: string) => setParams({ show: value }, { replace: true })

  if (!overview.data.hasCv) {
    return (
      <div className="flex flex-col gap-6">
        <Header title={t.resume.title} note={t.resume.note} />
        <Empty icon={<UserCircle size={26} />} title={t.resume.noCv}>
          <LinkButton to="/profile" className="mt-4">
            {t.nav.profile}
          </LinkButton>
        </Empty>
      </div>
    )
  }

  const shownProfile = selected.startsWith('profile:')
    ? resumes.data.find((r) => r.name === selected.slice(8))
    : undefined
  const shownApp = selected.startsWith('app:') ? selected.slice(4) : null

  return (
    <div className="flex flex-col gap-6">
      <Header title={t.resume.title} note={t.resume.note} />
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Panel as="aside" className="flex flex-col gap-4 self-start p-3 lg:sticky lg:top-6">
          <div>
            <p className="px-3 pt-1 pb-1.5 text-[12.5px] font-medium text-faint">{t.resume.base}</p>
            {base ? (
              <ListItem
                active={selected === `profile:${base.name}`}
                onClick={() => select(`profile:${base.name}`)}
                title={base.resume?.basics.name ?? base.name}
                note={
                  base.resume
                    ? `${t.resume.templates[base.resume.template]} · ${LANGUAGE_DATA[base.resume.language].name}`
                    : base.name
                }
                icon={<FileText size={20} className="shrink-0 text-accent-text" weight="duotone" />}
              />
            ) : (
              <div className="px-3 py-2">
                <p className="mb-3 text-[13px] text-muted">{t.resume.noBase}</p>
                <AiButton
                  task="tailor-resume"
                  variant="main"
                  size="small"
                  icon={<MagicWand size={16} className="shrink-0" />}
                  label={t.resume.build}
                  onDone={resumes.reload}
                  className="h-auto min-h-9 w-full py-2 text-left leading-snug"
                />
              </div>
            )}
            {translations.map((r) => (
              <ListItem
                key={r.name}
                active={selected === `profile:${r.name}`}
                onClick={() => select(`profile:${r.name}`)}
                title={r.resume ? LANGUAGE_DATA[r.resume.language].name : r.name}
                note={t.resume.translations}
                icon={<Translate size={20} className="shrink-0 text-muted" />}
              />
            ))}
          </div>
          <div className="border-t border-border pt-3">
            <p className="px-3 pb-1.5 text-[12.5px] font-medium text-faint">{t.resume.tailored}</p>
            {apps.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-faint">{t.resume.noApplications}</p>
            ) : (
              apps.map((a) => (
                <ListItem
                  key={a.slug}
                  active={selected === `app:${a.slug}`}
                  onClick={() => select(`app:${a.slug}`)}
                  title={a.company}
                  note={a.role}
                  icon={<CompanyTile name={a.company} size={30} />}
                  aside={<ScoreRing value={a.ats} size={30} stroke={3} label="ATS" />}
                />
              ))
            )}
          </div>
        </Panel>

        <div className="min-w-0">
          {shownProfile ? (
            <BasePreview file={shownProfile} isBase={shownProfile === base} onChanged={resumes.reload} />
          ) : shownApp ? (
            <TailoredPreview key={shownApp} slug={shownApp} />
          ) : (
            <Empty icon={<FileText size={26} />} title={t.resume.noBase}>
              <p>{t.resume.noBaseNote}</p>
            </Empty>
          )}
        </div>
      </div>
    </div>
  )
}
