/**
 * How a status looks. Red is the brand, so a rejection is NOT red here: it is the pink `danger` with an icon and the
 * word; an offer is a discreet green; everything in progress is neutral or the brand accent.
 */

import { CheckCircle, Prohibit } from '@phosphor-icons/react'
import type { Status } from '@shared/application'
import { useT } from '@/i18n'

/** Each stage's own color (`theme.css`, `--st-*`): the spectrum that runs through the board, the funnel and badges. */
export const stageColor = (status: Status) => `var(--st-${status})`

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const t = useT()
  const color = stageColor(status)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[13px] leading-5 font-medium whitespace-nowrap ${className ?? ''}`}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {status === 'offer' || status === 'accepted' ? (
        <CheckCircle size={14} weight="fill" aria-hidden />
      ) : status === 'rejected' ? (
        <Prohibit size={14} weight="bold" aria-hidden />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      )}
      {t.status[status]}
    </span>
  )
}

/** `15000`, `20000`, `BRL`, `month` → "R$ 15.000 – R$ 20.000 / month" in the interface locale. */
export function formatPay(
  pay: { min?: number; max?: number; currency: string; period: 'hour' | 'month' | 'year' },
  locale: string,
  periodLabel: string,
): string {
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: pay.currency, maximumFractionDigits: 0 }).format(n)
  const range =
    pay.min !== undefined && pay.max !== undefined
      ? `${money(pay.min)} – ${money(pay.max)}`
      : pay.min !== undefined
        ? `≥ ${money(pay.min)}`
        : `≤ ${money(pay.max!)}`
  return `${range} / ${periodLabel}`
}
