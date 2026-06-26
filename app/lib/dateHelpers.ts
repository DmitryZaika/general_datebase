import { format } from 'date-fns'
import type { DeadlineUrgency } from '~/types/dealActivityTypes'

const DAY_MS = 86_400_000

export interface DeadlineLabel {
  label: string
  urgency: DeadlineUrgency
}

function toDatetimeString(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return value.toISOString()
  }
  return String(value)
}

export function parseStoredLocalDatetime(value: unknown): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(Number.NaN) : value
  }

  const trimmed = toDatetimeString(value).trim()
  if (!trimmed) return new Date(Number.NaN)

  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed)
  }

  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  }

  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/,
  )
  if (localMatch) {
    const [, y, mo, d, h, mi, s] = localMatch
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
    )
  }

  return new Date(trimmed)
}

export const isDateOnlyDeadline = (iso: unknown): boolean => {
  const trimmed = toDatetimeString(iso).trim()
  if (!trimmed) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  if (match) {
    return match[2] === '00' && match[3] === '00' && match[4] === '00'
  }

  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return false
  if (trimmed.endsWith('Z')) {
    return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
  }
  return false
}

export const localCalendarDate = (iso: unknown): Date => {
  if (isDateOnlyDeadline(iso)) {
    const d = parseStoredLocalDatetime(iso)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  return parseStoredLocalDatetime(iso)
}

export const calendarDayDiff = (target: Date, now: Date = new Date()): number => {
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((targetDay.getTime() - nowDay.getTime()) / DAY_MS)
}

export const formatTimestamp = (iso: unknown): string => {
  const d = parseStoredLocalDatetime(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return format(d, sameYear ? 'MMM d, h:mm a' : 'MMM d, yyyy, h:mm a')
}

const isOverdueAt = (iso: unknown, now: Date): boolean => {
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
  return parseStoredLocalDatetime(iso).getTime() < now.getTime()
}

export const formatDeadlineLabel = (iso: unknown): DeadlineLabel => {
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
    : ` ${format(parseStoredLocalDatetime(iso), 'h:mm a')}`

  if (diff === 0) return { label: `Today${timeSuffix}`, urgency: 'today' }
  if (diff === 1) return { label: `Tomorrow${timeSuffix}`, urgency: 'soon' }
  return {
    label: format(cal, 'MMM d') + timeSuffix,
    urgency: diff <= 2 ? 'soon' : 'normal',
  }
}

export const formatPickerDeadline = (date: Date, hasTime = false): string => {
  return hasTime ? format(date, 'MMM d, yyyy h:mm a') : format(date, 'MMM d, yyyy')
}

export const buildDeadlinePayload = (
  deadline: Date | undefined,
  hasTime = false,
): string => {
  if (!deadline) return ''
  if (!hasTime) return format(deadline, 'yyyy-MM-dd')
  return format(deadline, 'yyyy-MM-dd HH:mm:ss')
}

export const MYSQL_LOCAL_DATETIME_FORMAT = '%Y-%m-%dT%H:%i:%s'
