/** Every application at a glance (`/api/overview`), kept fresh as the AI writes files. */

import type { Overview } from '@shared/api'
import { useData } from './api'
import { useAnyFileReload } from './events'

export function useOverview() {
  const data = useData<Overview>('/api/overview')
  useAnyFileReload(data.reload)
  return data
}

/** Whole days from today to an ISO date (negative = past), at local noon so time zones do not shift the day. */
export function daysFromToday(iso: string): number {
  const day = new Date(`${iso.slice(0, 10)}T12:00:00`)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.round((day.getTime() - today.getTime()) / 86_400_000)
}
