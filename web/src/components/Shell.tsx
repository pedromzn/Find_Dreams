/**
 * The shell: the navigation and the page frame. On a computer the navigation is a thin column on the left; on a
 * narrow window, a dock at the bottom. Copied from learning-anything's Shell, minus the rewards.
 */

import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Gear, Kanban, Plus, Robot, UserCircle } from '@phosphor-icons/react'
import { Brand } from './Brand'
import { join } from './ui'
import { useT } from '@/i18n'

const DESTINATIONS = [
  { to: '/', navKey: 'board', icon: Kanban, end: true },
  { to: '/new', navKey: 'newApplication', icon: Plus, end: false },
  { to: '/agent', navKey: 'agent', icon: Robot, end: false },
  { to: '/profile', navKey: 'profile', icon: UserCircle, end: false },
  { to: '/settings', navKey: 'settings', icon: Gear, end: false },
] as const

function Destination({ to, navKey, icon: Icon, end, compact }: (typeof DESTINATIONS)[number] & { compact?: boolean }) {
  const label = useT().nav[navKey]
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        join(
          'group relative flex items-center rounded-2xl transition-colors',
          compact ? 'h-12 w-14 flex-col justify-center gap-0.5 text-[11px]' : 'h-12 w-12 justify-center',
          isActive ? 'text-accent-text' : 'text-faint hover:text-text',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute inset-0 rounded-2xl bg-accent/15" />}
          <Icon size={compact ? 20 : 22} weight={isActive ? 'fill' : 'regular'} className="relative" />
          {compact ? (
            <span className="relative">{label}</span>
          ) : (
            <span className="pointer-events-none absolute left-full z-50 ml-3 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-sm whitespace-nowrap text-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const t = useT()
  return (
    <div className="relative isolate min-h-dvh">
      <nav
        aria-label={t.nav.main}
        className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center py-6 md:flex"
      >
        <NavLink to="/" aria-label={t.general.appName} className="mb-8">
          <Brand size={34} />
        </NavLink>
        <div className="card flex flex-col gap-1 rounded-[24px] p-1.5">
          {DESTINATIONS.map((d) => (
            <Destination key={d.to} {...d} />
          ))}
        </div>
      </nav>
      <nav
        aria-label={t.nav.main}
        className="card fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-[22px] p-1.5 md:hidden"
      >
        {DESTINATIONS.map((d) => (
          <Destination key={d.to} {...d} compact />
        ))}
      </nav>
      <main className="relative mx-auto max-w-7xl px-4 pt-8 pb-28 sm:px-8 md:pb-16 md:pl-28">{children}</main>
    </div>
  )
}
