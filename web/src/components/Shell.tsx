/**
 * The shell: the navigation and the page frame, mounted once (a layout route) so it does not reload on every screen.
 *
 * On a computer the navigation is a sidebar with labels, grouped by what the person is doing (searching, preparing
 * materials, preparing for interviews); it folds into an icon rail, and the choice is remembered. On a narrow window
 * it becomes a dock at the bottom with the main destinations.
 */

import { useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Briefcase,
  CaretDoubleLeft,
  CaretDoubleRight,
  ChatsCircle,
  Compass,
  EnvelopeSimple,
  Gear,
  House,
  Plus,
  Robot,
  Toolbox,
  FileText,
  type IconProps,
} from '@phosphor-icons/react'
import type { ProfileData } from '@shared/api'
import type { Dictionary } from '@/i18n/en'
import { Brand } from './Brand'
import { join } from './ui'
import { useT } from '@/i18n'
import { useData } from '@/lib/api'
import { useAgents } from '@/agent/useAgents'

type NavKey = keyof Dictionary['nav']
interface Destination {
  to: string
  navKey: NavKey
  icon: ComponentType<IconProps>
  end?: boolean
}

const GROUPS: Array<{ key: 'groupSearch' | 'groupMaterials' | 'groupPrep'; items: Destination[] }> = [
  {
    key: 'groupSearch',
    items: [
      { to: '/', navKey: 'home', icon: House, end: true },
      { to: '/applications', navKey: 'board', icon: Briefcase },
      { to: '/discover', navKey: 'discover', icon: Compass },
    ],
  },
  {
    key: 'groupMaterials',
    items: [
      { to: '/resumes', navKey: 'resumes', icon: FileText },
      { to: '/letters', navKey: 'letters', icon: EnvelopeSimple },
    ],
  },
  {
    key: 'groupPrep',
    items: [
      { to: '/interviews', navKey: 'interviews', icon: ChatsCircle },
      { to: '/tools', navKey: 'tools', icon: Toolbox },
    ],
  },
]

const DOCK: Destination[] = [
  { to: '/', navKey: 'home', icon: House, end: true },
  { to: '/applications', navKey: 'board', icon: Briefcase },
  { to: '/applications/new', navKey: 'newApplication', icon: Plus, end: true },
  { to: '/interviews', navKey: 'interviews', icon: ChatsCircle },
  { to: '/tools', navKey: 'tools', icon: Toolbox },
]

const COLLAPSED_KEY = 'mzn-vagas:sidebar-collapsed'

function storedCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function Item({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  badge,
}: Omit<Destination, 'navKey'> & {
  label: string
  collapsed: boolean
  badge?: React.ReactNode
}) {
  const { pathname } = useLocation()
  // "/applications" stays lit inside an application, but not on the "new application" form
  const forceOff = to === '/applications' && pathname === '/applications/new'
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        join(
          'group relative flex h-10 items-center gap-3 rounded-tile text-[14.5px] transition-colors',
          collapsed ? 'w-10 justify-center' : 'px-3',
          isActive && !forceOff
            ? 'bg-surface-3 font-medium text-text'
            : 'text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      {({ isActive }) => {
        const on = isActive && !forceOff
        return (
          <>
            {on && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent" aria-hidden />}
            <Icon size={19} weight={on ? 'fill' : 'regular'} className={on ? 'text-accent-text' : ''} />
            {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
            {!collapsed && badge}
            {collapsed && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-sm whitespace-nowrap text-text opacity-0 shadow-[var(--shadow-pop)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {label}
              </span>
            )}
          </>
        )
      }}
    </NavLink>
  )
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

function Sidebar({ collapsed, toggle }: { collapsed: boolean; toggle: () => void }) {
  const t = useT()
  const profile = useData<ProfileData>('/api/profile')
  const agents = useAgents()
  const selected = agents.data?.agents.find((a) => a.id === agents.data?.selected)
  const agentReady = Boolean(selected?.installed && !selected.needsSecret)
  const name = profile.data?.profile?.name ?? ''

  return (
    <nav
      aria-label={t.nav.main}
      className={join(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface md:flex',
        collapsed ? 'w-[72px] items-center px-2' : 'w-[248px] px-4',
      )}
    >
      <div className={join('flex h-16 shrink-0 items-center gap-2.5', collapsed ? 'justify-center' : 'px-1')}>
        <NavLink to="/" aria-label={t.general.appName} className="flex items-center gap-2.5 no-underline">
          <Brand size={34} />
          {!collapsed && <span className="text-[17px] font-semibold tracking-tight text-text">MZN Vagas</span>}
        </NavLink>
      </div>

      <NavLink
        to="/applications/new"
        aria-label={collapsed ? t.nav.newApplication : undefined}
        className={join(
          'mt-2 mb-5 flex h-10 shrink-0 items-center justify-center gap-2 rounded-tile bg-accent text-[14.5px] font-medium text-on-accent no-underline transition-colors hover:bg-accent-hover',
          collapsed ? 'w-10' : 'w-full',
        )}
      >
        <Plus size={17} weight="bold" />
        {!collapsed && t.nav.newApplication}
      </NavLink>

      <div className={join('flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto', collapsed && 'items-center')}>
        {GROUPS.map((group) => (
          <div key={group.key} className={join('flex flex-col gap-0.5', collapsed && 'items-center')}>
            {collapsed ? (
              <span className="mb-1 h-px w-6 bg-border" aria-hidden />
            ) : (
              <p className="mb-1 px-3 text-[12.5px] font-medium text-faint">{t.nav[group.key]}</p>
            )}
            {group.items.map((d) => (
              <Item key={d.to} {...d} label={t.nav[d.navKey]} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </div>

      <div
        className={join(
          'flex shrink-0 flex-col gap-0.5 border-t border-border py-3',
          collapsed ? 'items-center' : '-mx-4 px-4',
        )}
      >
        <Item
          to="/agent"
          label={t.nav.agent}
          icon={Robot}
          collapsed={collapsed}
          badge={
            <span
              className={join('h-2 w-2 rounded-full', agentReady ? 'bg-success' : 'bg-border-strong')}
              title={agentReady ? selected!.name : t.nav.noAgent}
              aria-label={agentReady ? selected!.name : t.nav.noAgent}
            />
          }
        />
        <Item to="/settings" label={t.nav.settings} icon={Gear} collapsed={collapsed} />
        <NavLink
          to="/profile"
          aria-label={collapsed ? t.nav.profile : undefined}
          className={({ isActive }) =>
            join(
              'mt-1 flex items-center gap-3 rounded-tile no-underline transition-colors',
              collapsed ? 'h-10 w-10 justify-center' : 'px-2 py-2',
              isActive ? 'bg-surface-3' : 'hover:bg-surface-2',
            )
          }
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-st-screening/20 text-[13px] font-semibold text-st-screening">
            {initials(name) || '·'}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text">{name || t.nav.profile}</span>
              <span className="block truncate text-xs text-faint">{t.nav.profile}</span>
            </span>
          )}
        </NavLink>
        <button
          type="button"
          onClick={toggle}
          className={join(
            'mt-1 flex h-9 items-center gap-3 rounded-tile text-sm text-faint transition-colors hover:bg-surface-2 hover:text-text',
            collapsed ? 'w-10 justify-center' : 'px-3',
          )}
          aria-label={collapsed ? t.nav.expand : t.nav.collapse}
          title={collapsed ? t.nav.expand : t.nav.collapse}
        >
          {collapsed ? <CaretDoubleRight size={16} /> : <CaretDoubleLeft size={16} />}
          {!collapsed && t.nav.collapse}
        </button>
      </div>
    </nav>
  )
}

function Dock() {
  const t = useT()
  return (
    <nav
      aria-label={t.nav.main}
      className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[20px] border border-border bg-surface p-1.5 shadow-[var(--shadow-pop)] md:hidden"
    >
      {DOCK.map(({ to, navKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            join(
              'flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] no-underline',
              isActive ? 'bg-surface-3 text-text' : 'text-faint',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} weight={isActive ? 'fill' : 'regular'} className={isActive ? 'text-accent-text' : ''} />
              <span className="max-w-full truncate px-1">{t.nav[navKey]}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function Shell() {
  const [collapsed, setCollapsed] = useState(storedCollapsed)
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        /* private window */
      }
      return !c
    })
  return (
    <div className="relative isolate min-h-dvh">
      <Sidebar collapsed={collapsed} toggle={toggle} />
      <Dock />
      <main
        className={join(
          'relative px-4 pt-6 pb-28 sm:px-6 md:pb-12 lg:px-10 lg:pt-8',
          collapsed ? 'md:ml-[72px]' : 'md:ml-[248px]',
        )}
      >
        <div className="mx-auto max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
