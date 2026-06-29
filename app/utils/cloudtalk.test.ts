import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const selectId = vi.fn()

vi.mock('~/utils/queryHelpers', () => ({
  selectId: (...args: unknown[]) => selectId(...args),
}))

beforeEach(async () => {
  selectId.mockReset()
  selectId.mockResolvedValue({
    cloudtalk_access_key: 'key',
    cloudtalk_access_secret: 'secret',
  })
  const { resetRateLimiter, resetCloudTalkAuthCache } = await import(
    './cloudtalk.server'
  )
  resetRateLimiter()
  resetCloudTalkAuthCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('coerceId', () => {
  it('accepts positive integers', async () => {
    const { coerceId } = await import('./cloudtalk.server')
    expect(coerceId(1)).toBe(1)
    expect(coerceId(1779762076)).toBe(1779762076)
  })

  it('accepts digit-only strings', async () => {
    const { coerceId } = await import('./cloudtalk.server')
    expect(coerceId('1779762076')).toBe(1779762076)
    expect(coerceId('1')).toBe(1)
  })

  it('rejects zero, negatives, and non-integer numbers', async () => {
    const { coerceId } = await import('./cloudtalk.server')
    expect(coerceId(0)).toBeNull()
    expect(coerceId(-1)).toBeNull()
    expect(coerceId(1.5)).toBeNull()
    expect(coerceId(Number.NaN)).toBeNull()
    expect(coerceId(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('rejects empty, padded, and non-digit strings', async () => {
    const { coerceId } = await import('./cloudtalk.server')
    expect(coerceId('')).toBeNull()
    expect(coerceId('0')).toBeNull()
    expect(coerceId('-1')).toBeNull()
    expect(coerceId(' 123 ')).toBeNull()
    expect(coerceId('1e10')).toBeNull()
    expect(coerceId('123abc')).toBeNull()
  })

  it('rejects strings exceeding Number.MAX_SAFE_INTEGER', async () => {
    const { coerceId } = await import('./cloudtalk.server')
    expect(coerceId('9007199254740993')).toBeNull()
  })

  it('rejects non-string, non-number values', async () => {
    const { coerceId } = await import('./cloudtalk.server')
    expect(coerceId(null)).toBeNull()
    expect(coerceId(undefined)).toBeNull()
    expect(coerceId({})).toBeNull()
    expect(coerceId([])).toBeNull()
    expect(coerceId(true)).toBeNull()
  })
})

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows immediate burst up to capacity', async () => {
    const { RateLimiter } = await import('./cloudtalk.server')
    const limiter = new RateLimiter(60)
    for (let i = 0; i < 60; i++) await limiter.acquire()
  })

  it('blocks when capacity is exhausted and unblocks when a token refills', async () => {
    const { RateLimiter } = await import('./cloudtalk.server')
    const limiter = new RateLimiter(60)
    for (let i = 0; i < 60; i++) await limiter.acquire()

    let resolved = false
    const pending = limiter.acquire().then(() => {
      resolved = true
    })

    await vi.advanceTimersByTimeAsync(500)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(600)
    await pending
    expect(resolved).toBe(true)
  })

  it('refills tokens proportionally to elapsed time', async () => {
    const { RateLimiter } = await import('./cloudtalk.server')
    const limiter = new RateLimiter(60)
    for (let i = 0; i < 60; i++) await limiter.acquire()

    await vi.advanceTimersByTimeAsync(5000)

    for (let i = 0; i < 5; i++) await limiter.acquire()

    let resolved = false
    limiter.acquire().then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(resolved).toBe(false)
  })
})

describe('getAuthString cache', () => {
  it('hits the DB once per company across repeated calls', async () => {
    const { getAuthString } = await import('./cloudtalk.server')

    await getAuthString(7)
    await getAuthString(7)
    await getAuthString(7)

    expect(selectId).toHaveBeenCalledTimes(1)
  })

  it('refetches after resetCloudTalkAuthCache', async () => {
    const { getAuthString, resetCloudTalkAuthCache } = await import(
      './cloudtalk.server'
    )

    await getAuthString(7)
    expect(selectId).toHaveBeenCalledTimes(1)

    resetCloudTalkAuthCache()
    await getAuthString(7)
    expect(selectId).toHaveBeenCalledTimes(2)
  })

  it('caches per company independently', async () => {
    const { getAuthString } = await import('./cloudtalk.server')

    await getAuthString(7)
    await getAuthString(8)
    await getAuthString(7)

    expect(selectId).toHaveBeenCalledTimes(2)
  })
})
