/** Cover letters: one per application, picked on the left, written and edited on the right. */

import { CheckCircle, Circle, EnvelopeSimple } from '@phosphor-icons/react'
import type { ApplicationDetail } from '@shared/api'
import { Empty, Header, LinkButton, Loading, ScreenError } from '@/components/ui'
import { AppPicker, useSelectedApp } from '@/components/AppPicker'
import { useT } from '@/i18n'
import { useData } from '@/lib/api'
import { useLiveReload } from '@/lib/events'
import { useOverview } from '@/lib/overview'
import { LetterEditor } from '@/letter/LetterEditor'

function Letter({ slug }: { slug: string }) {
  const detail = useData<ApplicationDetail>(`/api/applications/${slug}`)
  useLiveReload(detail.reload, slug)
  if (detail.error) return <ScreenError error={detail.error} onRetry={detail.reload} />
  if (!detail.data) return <Loading />
  return <LetterEditor detail={detail.data} reload={detail.reload} />
}

export default function Letters() {
  const t = useT()
  const overview = useOverview()
  const apps = overview.data?.applications ?? []
  const { selected, select } = useSelectedApp(apps)
  if (overview.error) return <ScreenError error={overview.error} onRetry={overview.reload} />
  if (!overview.data) return <Loading />
  return (
    <div className="flex flex-col gap-6">
      <Header title={t.letters.title} note={t.letters.note} />
      {apps.length === 0 ? (
        <Empty icon={<EnvelopeSimple size={26} />} title={t.letters.noApplications}>
          <LinkButton to="/applications/new" className="mt-4">
            {t.nav.newApplication}
          </LinkButton>
        </Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <AppPicker
            apps={apps}
            selected={selected?.slug ?? null}
            onSelect={select}
            title={t.letters.pick}
            mark={(a) =>
              a.hasLetter ? (
                <CheckCircle size={18} weight="fill" className="shrink-0 text-success" aria-label={t.letters.ready} />
              ) : (
                <Circle size={18} className="shrink-0 text-border-strong" aria-label={t.letters.missing} />
              )
            }
          />
          <div className="min-w-0">{selected && <Letter key={selected.slug} slug={selected.slug} />}</div>
        </div>
      )}
    </div>
  )
}
