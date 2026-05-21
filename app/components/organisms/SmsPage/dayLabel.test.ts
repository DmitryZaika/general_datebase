import { describe, expect, it } from 'vitest'
import { formatDayLabel } from './dayLabel'

const NOW = new Date('2026-05-21T15:30:00Z')

describe('formatDayLabel', () => {
  it('returns "Today" for any time on the current calendar day', () => {
    expect(formatDayLabel(new Date('2026-05-21T08:00:00Z'), NOW)).toBe('Today')
    expect(formatDayLabel(new Date('2026-05-21T23:59:00Z'), NOW)).toBe('Today')
    expect(formatDayLabel(new Date('2026-05-21T00:00:01Z'), NOW)).toBe('Today')
  })

  it('returns "Yesterday" for the previous calendar day', () => {
    expect(formatDayLabel(new Date('2026-05-20T08:00:00Z'), NOW)).toBe('Yesterday')
    expect(formatDayLabel(new Date('2026-05-20T23:59:00Z'), NOW)).toBe('Yesterday')
  })

  it('returns the weekday name for dates within the last week', () => {
    // 2026-05-18 = Monday, 3 days back
    expect(formatDayLabel(new Date('2026-05-18T12:00:00Z'), NOW)).toBe('Monday')
    // 2026-05-16 = Saturday, 5 days back
    expect(formatDayLabel(new Date('2026-05-16T12:00:00Z'), NOW)).toBe('Saturday')
  })

  it('returns the full date for older messages (>= 7 days)', () => {
    // 8 days ago — out of weekday window
    expect(formatDayLabel(new Date('2026-05-13T12:00:00Z'), NOW)).toBe('May 13, 2026')
    expect(formatDayLabel(new Date('2025-12-01T12:00:00Z'), NOW)).toBe('Dec 1, 2025')
  })

  it('handles boundary at midnight (last second of previous day is Yesterday)', () => {
    const lateYesterday = new Date('2026-05-20T23:59:59Z')
    expect(formatDayLabel(lateYesterday, NOW)).toBe('Yesterday')
  })
})
