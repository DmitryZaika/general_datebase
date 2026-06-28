import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { acquireUserSlot, resetUserRateLimiter } from './userRateLimiter.server'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-21T12:00:00Z'))
  resetUserRateLimiter()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('acquireUserSlot', () => {
  test('allows up to capacity within the window', () => {
    for (let i = 0; i < 10; i++) {
      expect(acquireUserSlot({ userId: 1, capacity: 10, windowMs: 60_000 })).toBe(true)
    }
    expect(acquireUserSlot({ userId: 1, capacity: 10, windowMs: 60_000 })).toBe(false)
  })

  test('refills tokens as time advances', () => {
    for (let i = 0; i < 10; i++) {
      acquireUserSlot({ userId: 1, capacity: 10, windowMs: 60_000 })
    }
    vi.advanceTimersByTime(60_000)
    expect(acquireUserSlot({ userId: 1, capacity: 10, windowMs: 60_000 })).toBe(true)
  })

  test('per-user buckets are isolated', () => {
    for (let i = 0; i < 10; i++) {
      acquireUserSlot({ userId: 1, capacity: 10, windowMs: 60_000 })
    }
    expect(acquireUserSlot({ userId: 1, capacity: 10, windowMs: 60_000 })).toBe(false)
    expect(acquireUserSlot({ userId: 2, capacity: 10, windowMs: 60_000 })).toBe(true)
  })
})
