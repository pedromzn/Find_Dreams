/**
 * The app kit. Few pieces, each with one job: the button, the panel, the badge, the form fields, the tabs, the text to
 * copy, and the loading, empty and error states. Color and radius come from the tokens in `style/theme.css`. Copied
 * from the sibling projects' `ui.tsx`, re-toned for black and red.
 */

import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Check, Copy, WarningCircle } from '@phosphor-icons/react'
import { useT } from '@/i18n'

export const join = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

// ── button ───────────────────────────────────────────────────────────────────

type Variant = 'main' | 'subtle' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  main: 'bg-accent text-on-accent hover:bg-accent-hover active:translate-y-px disabled:opacity-50',
  subtle:
    'border border-border bg-surface-2 text-text hover:border-border-strong hover:bg-surface-3 disabled:opacity-50',
  ghost: 'text-muted hover:text-text hover:bg-surface-2 disabled:opacity-40',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-50',
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-tile font-medium no-underline transition-[background,color,transform] duration-150 select-none disabled:cursor-not-allowed'

const SIZES = { normal: 'h-10 px-4 text-[14.5px]', small: 'h-8 px-3 text-[13.5px]', large: 'h-12 px-6 text-base' }

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: keyof typeof SIZES
  icon?: ReactNode
}

export function Button({ variant = 'main', size = 'normal', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={join(BUTTON_BASE, SIZES[size], VARIANTS[variant], className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export function LinkButton({
  variant = 'main',
  size = 'normal',
  icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: keyof typeof SIZES; icon?: ReactNode }) {
  return (
    <Link className={join(BUTTON_BASE, SIZES[size], VARIANTS[variant], className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

// ── surfaces ─────────────────────────────────────────────────────────────────

export function Panel({
  className,
  children,
  as: Tag = 'section',
}: {
  className?: string
  children: ReactNode
  as?: 'section' | 'div' | 'article' | 'aside'
}) {
  return <Tag className={join('card rounded-panel', className)}>{children}</Tag>
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

/** The badge: a short label. `tone` says what it means; it is not decoration. */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  const tones: Record<Tone, string> = {
    neutral: 'border-border text-muted',
    accent: 'border-accent/50 text-accent-text bg-accent/10',
    success: 'border-success/40 text-success bg-success/8',
    warning: 'border-warning/40 text-warning bg-warning/8',
    danger: 'border-danger/40 text-danger bg-danger/8',
  }
  return (
    <span
      className={join(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[13px] leading-5 whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** A screen header: a big title and, if any, a supporting line and the actions on the right. */
export function Header({
  title,
  note,
  actions,
  className,
}: {
  title: ReactNode
  note?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={join('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0">
        <h1 className="text-[clamp(1.6rem,2.6vw,2.1rem)]">{title}</h1>
        {note && <p className="mt-1.5 max-w-[72ch] text-muted">{note}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

// ── form fields ──────────────────────────────────────────────────────────────

const FIELD =
  'rounded-tile border border-border bg-surface-2 px-3.5 py-2.5 text-[15px] text-text placeholder:text-faint transition-colors hover:border-border-strong focus:border-accent focus:outline-none'

/** A label, the control and an optional hint or error under it. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  children: (id: string) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={join('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="flex items-center gap-1.5 text-sm text-danger" role="alert">
          <WarningCircle size={14} weight="fill" aria-hidden />
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-faint">{hint}</p>
      )}
    </div>
  )
}

/** Full width unless the caller sets its own width (`w-auto`, `w-48`…). */
const width = (className?: string) => (/(^|\s)w-/.test(className ?? '') ? '' : 'w-full')

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={join(FIELD, width(className), className)} {...rest} />
)

export const TextArea = ({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={join(FIELD, 'w-full min-h-32 leading-6', className)} {...rest} />
)

export const Select = ({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={join(FIELD, width(className), 'appearance-none pr-8', className)} {...rest}>
    {children}
  </select>
)

// ── tabs ─────────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({
  tabs,
  current,
  onChange,
  label,
}: {
  tabs: Array<{ id: T; label: ReactNode; count?: number }>
  current: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === current}
          onClick={() => onChange(tab.id)}
          className={join(
            '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors',
            tab.id === current ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text',
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="rounded-pill bg-surface-2 px-1.5 text-xs text-muted">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── text to copy ─────────────────────────────────────────────────────────────

/** A text to paste into the AI (or a terminal command), with a copy button. */
export function Command({ text, label, className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const t = useT()
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* no clipboard permission: the text stays selectable */
    }
  }
  return (
    <div className={join('rounded-tile border border-border bg-bg', className)}>
      {label && <div className="border-b border-border px-4 py-2 text-[13px] text-muted">{label}</div>}
      <div className="flex items-start gap-3 p-4">
        <code className="min-w-0 flex-1 font-mono text-[13px] leading-6 break-words whitespace-pre-wrap text-text select-all">
          {text}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-border p-2 text-muted transition-colors hover:border-border-strong hover:text-text"
          aria-label={copied ? t.general.copied : t.general.copy}
        >
          {copied ? <Check size={16} weight="bold" className="text-success" /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  )
}

// ── states ───────────────────────────────────────────────────────────────────

/** Loading: three red dots taking turns. */
export function Loading({ text, className }: { text?: string; className?: string }) {
  const t = useT()
  return (
    <div className={join('flex items-center justify-center gap-3 py-16 text-muted', className)} role="status">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </span>
      <span className="text-sm">{text ?? t.general.loading}</span>
    </div>
  )
}

export function ScreenError({ error, onRetry }: { error: { message: string }; onRetry?: () => void }) {
  const t = useT()
  return (
    <Panel className="mx-auto mt-10 max-w-lg p-6">
      <div className="flex gap-3">
        <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="text-text">{error.message}</p>
          {onRetry && (
            <Button variant="subtle" size="small" className="mt-4" onClick={onRetry}>
              {t.general.tryAgain}
            </Button>
          )}
        </div>
      </div>
    </Panel>
  )
}

/** The inline error of a form or an action. Always icon + text: the color alone never carries the meaning. */
export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="flex items-start gap-2 text-sm text-danger" role="alert">
      <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
      {message}
    </p>
  )
}

/** File problems found by the validator, listed so the person (or their AI) can fix them. */
export function Problems({ problems, file }: { problems: string[]; file?: string }) {
  const t = useT()
  if (!problems.length) return null
  return (
    <div className="rounded-tile border border-danger/40 bg-danger/5 p-4 text-sm" role="alert">
      <p className="flex items-center gap-2 font-medium text-danger">
        <WarningCircle size={16} weight="fill" aria-hidden />
        {t.general.fileProblems(file)}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-muted">
        {problems.map((p) => (
          <li key={p} className="font-mono text-[13px]">
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Empty({
  icon,
  title,
  children,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={join(
        'flex flex-col items-center gap-3 rounded-panel border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon}</span>
      )}
      <p className="font-medium text-text">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}

// ── v2 pieces ────────────────────────────────────────────────────────────────

/** A panel with a title row (and an optional action on the right): the building block of the overview screens. */
export function Section({
  title,
  note,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode
  note?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Panel className={join('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="font-sans text-[15px] font-semibold tracking-normal text-text">{title}</h2>
          {note && <p className="mt-0.5 text-[13px] text-faint">{note}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={join('flex-1 p-5', bodyClassName)}>{children}</div>
    </Panel>
  )
}

/** A number in a ring: fit and ATS scores (0–100). The color says the level, the number says the value. */
export function ScoreRing({
  value,
  size = 64,
  stroke = 6,
  label,
  className,
}: {
  value: number | null
  size?: number
  stroke?: number
  label: string
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = value === null ? 0 : Math.max(0, Math.min(100, value))
  const color =
    value === null ? 'var(--border-strong)' : v >= 75 ? 'var(--success)' : v >= 50 ? 'var(--warning)' : 'var(--danger)'
  return (
    <span
      className={join('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${value === null ? '—' : value}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <span
        className="absolute font-semibold text-text tabular-nums"
        style={{ fontSize: Math.max(11, size * 0.28) }}
        aria-hidden
      >
        {value === null ? '—' : value}
      </span>
    </span>
  )
}

/** A big number with its label: the metric tiles. */
export function Stat({
  label,
  value,
  note,
  accent,
  className,
}: {
  label: ReactNode
  value: ReactNode
  note?: ReactNode
  /** a stage color (`var(--st-applied)`) for the small bar on top */
  accent?: string
  className?: string
}) {
  return (
    <Panel className={join('relative flex flex-col gap-1 overflow-hidden px-5 py-4', className)}>
      {accent && <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} aria-hidden />}
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[28px] leading-tight font-semibold tracking-tight text-text tabular-nums">{value}</span>
      {note && <span className="text-xs text-faint">{note}</span>}
    </Panel>
  )
}

/** A segmented control: two to four choices, one active (view modes, templates, tones, theme). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'normal',
}: {
  options: Array<{ id: T; label: ReactNode; icon?: ReactNode }>
  value: T
  onChange: (id: T) => void
  label: string
  size?: 'normal' | 'small'
}) {
  return (
    <div
      className="inline-flex rounded-tile border border-border bg-surface-2 p-0.5"
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={join(
            'flex items-center gap-1.5 rounded-[8px] font-medium transition-colors',
            size === 'small' ? 'px-2.5 py-1 text-[13px]' : 'px-3 py-1.5 text-sm',
            value === o.id ? 'bg-surface text-text shadow-[var(--shadow)]' : 'text-muted hover:text-text',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
