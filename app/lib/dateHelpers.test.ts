import { describe, expect, it } from 'vitest'
import { formatTimestamp, parseStoredLocalDatetime } from './dateHelpers'

describe('parseStoredLocalDatetime', () => {
  it('parses UTC ISO strings without treating them as local wall clock', () => {
    const parsed = parseStoredLocalDatetime('2026-06-13T18:33:00.000Z')
    expect(parsed.toISOString()).toBe('2026-06-13T18:33:00.000Z')
  })

  it('parses mysql-style local datetimes as local wall clock', () => {
    const parsed = parseStoredLocalDatetime('2026-06-13 14:33:00')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(5)
    expect(parsed.getDate()).toBe(13)
    expect(parsed.getHours()).toBe(14)
    expect(parsed.getMinutes()).toBe(33)
  })
})

describe('formatTimestamp', () => {
  it('formats UTC ISO strings in the viewer local timezone', () => {
    const formatted = formatTimestamp('2026-06-13T18:33:00.000Z')
    const expected = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date('2026-06-13T18:33:00.000Z'))
    expect(formatted).toBe(expected)
  })
})
