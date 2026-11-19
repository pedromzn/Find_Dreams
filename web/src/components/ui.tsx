/**
 * The app kit. Few pieces, each with one job. Color and radius come from the tokens in `style/theme.css`; it grows with
 * the screens (button, card, badge, states) as they need it, copying the sibling projects' `ui.tsx`.
 */

import { CircleNotch } from '@phosphor-icons/react'
import { useT } from '@/i18n'

export const join = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

export function Loading() {
  const t = useT()
  return (
    <div className="grid place-items-center py-16 text-muted" role="status">
      <CircleNotch size={28} className="animate-spin" aria-hidden />
      <span className="sr-only">{t.general.loading}</span>
    </div>
  )
}
