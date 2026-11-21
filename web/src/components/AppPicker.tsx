/**
 * The overview screens' left column: every application, the selected one lit, an optional mark on the right (a check,
 * a score). The selection lives in the URL (`?app=`), so a link can open a screen on one application.
 */

import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OverviewApplication } from '@shared/api'
import { CompanyTile } from '@/pages/Board'
import { stageColor } from '@/application/labels'
import { Panel, join } from './ui'

export function useSelectedApp(apps: OverviewApplication[]) {
  const [params, setParams] = useSearchParams()
  const slug = params.get('app')
  const selected = apps.find((a) => a.slug === slug) ?? apps[0] ?? null
  return { selected, select: (s: string) => setParams({ app: s }, { replace: true }) }
}

export function AppPicker({
  apps,
  selected,
  onSelect,
  title,
  mark,
}: {
  apps: OverviewApplication[]
  selected: string | null
  onSelect: (slug: string) => void
  title: string
  mark?: (a: OverviewApplication) => ReactNode
}) {
  return (
    <Panel as="aside" className="flex flex-col self-start p-2 lg:sticky lg:top-6">
      <p className="px-3 pt-2 pb-1.5 text-[12.5px] font-medium text-faint">{title}</p>
      <div className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto">
        {apps.map((a) => (
          <button
            key={a.slug}
            type="button"
            onClick={() => onSelect(a.slug)}
            aria-current={a.slug === selected ? 'true' : undefined}
            className={join(
              'relative flex w-full items-center gap-3 rounded-tile px-3 py-2.5 text-left transition-colors',
              a.slug === selected ? 'bg-surface-3' : 'hover:bg-surface-2',
            )}
          >
            <CompanyTile name={a.company} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-text">{a.company}</span>
              <span className="flex items-center gap-1.5 text-[12.5px] text-faint">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: stageColor(a.status) }} />
                <span className="truncate">{a.role}</span>
              </span>
            </span>
            {mark?.(a)}
          </button>
        ))}
      </div>
    </Panel>
  )
}
