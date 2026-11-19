/**
 * How a status looks. Red is the brand, so a rejection is NOT red here: it is the pink `danger` with an icon and the
 * word; an offer is a discreet green; everything in progress is neutral or the brand accent.
 */

import { CheckCircle, Prohibit } from '@phosphor-icons/react'
import type { Status } from '@shared/application'
import { Badge, type Tone } from '@/components/ui'
import { useT } from '@/i18n'

const TONE: Record<Status, Tone> = {
  saved: 'neutral',
  applied: 'neutral',
  screening: 'accent',
  interviewing: 'accent',
  offer: 'success',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
  ghosted: 'warning',
}

export function StatusBadge({ status }: { status: Status }) {
  const t = useT()
  return (
    <Badge tone={TONE[status]}>
      {(status === 'offer' || status === 'accepted') && <CheckCircle size={14} weight="fill" aria-hidden />}
      {status === 'rejected' && <Prohibit size={14} weight="bold" aria-hidden />}
      {t.status[status]}
    </Badge>
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
