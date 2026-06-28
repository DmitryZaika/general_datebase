import { differenceInDays, format, isSameDay, subDays } from 'date-fns'

// `now` is injectable so tests can pass a fixed reference time.
export function formatDayLabel(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return 'Today'
  if (isSameDay(date, subDays(now, 1))) return 'Yesterday'
  const days = differenceInDays(now, date)
  if (days < 7) return format(date, 'EEEE')
  return format(date, 'MMM d, yyyy')
}
