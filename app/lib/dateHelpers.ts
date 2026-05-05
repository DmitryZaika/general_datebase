import { format } from 'date-fns'
import type { DeadlineUrgency } from '~/types/dealActivityTypes'

const DAY_MS = 86_400_000

export interface DeadlineLabel {
  label: string
  urgency: DeadlineUrgency
}

// Deadlines the user picked without a time are stored as midnight UTC.
// Detect them by their UTC components, not local — local time depends on
// the viewer and would misclassify the same deadline across timezones.
export const isDateOnlyDeadline = (iso: string): boolean => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
}

// For a date-only deadline, return a local Date at midnight on the same
// calendar day so calendar-diff (Today/Tomorrow) works in any timezone.
export const localCalendarDate = (iso: string): Date => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return d
  if (isDateOnlyDeadline(iso)) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  return d
}

export const calendarDayDiff = (target: Date, now: Date = new Date()): number => {
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((targetDay.getTime() - nowDay.getTime()) / DAY_MS)
}

export const formatTimestamp = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return format(d, sameYear ? 'MMM d, h:mm a' : 'MMM d, yyyy, h:mm a')
}

const isOverdueAt = (iso: string, now: Date): boolean => {
  if (isDateOnlyDeadline(iso)) {
    const cal = localCalendarDate(iso)
    const endOfDay = new Date(
      cal.getFullYear(),
      cal.getMonth(),
      cal.getDate(),
      23,
      59,
      59,
      999,
    )
    return endOfDay.getTime() < now.getTime()
  }
  return new Date(iso).getTime() < now.getTime()
}

export const formatDeadlineLabel = (iso: string): DeadlineLabel => {
  const now = new Date()
  const cal = localCalendarDate(iso)
  const diff = calendarDayDiff(cal, now)

  if (isOverdueAt(iso, now)) {
    const overdueDays = Math.abs(diff)
    return {
      label: overdueDays === 0 ? 'Overdue' : `${overdueDays}d overdue`,
      urgency: 'overdue',
    }
  }

  const timeSuffix = isDateOnlyDeadline(iso)
    ? ''
    : ` ${format(new Date(iso), 'h:mm a')}`

  if (diff === 0) return { label: `Today${timeSuffix}`, urgency: 'today' }
  if (diff === 1) return { label: `Tomorrow${timeSuffix}`, urgency: 'soon' }
  return {
    label: format(cal, 'MMM d') + timeSuffix,
    urgency: diff <= 2 ? 'soon' : 'normal',
  }
}

export const formatPickerDeadline = (date: Date): string => {
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  return hasTime ? format(date, 'MMM d, yyyy h:mm a') : format(date, 'MMM d, yyyy')
}

// Build the deadline form payload. Timed → ISO UTC; date-only → "YYYY-MM-DD".
// The server's toMySQLDatetime accepts both shapes.
export const buildDeadlinePayload = (deadline: Date | undefined): string => {
  if (!deadline) return ''
  const hasTime = deadline.getHours() !== 0 || deadline.getMinutes() !== 0
  return hasTime ? deadline.toISOString() : format(deadline, 'yyyy-MM-dd')
}
