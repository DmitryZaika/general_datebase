import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const selectId = vi.fn()

vi.mock('~/utils/queryHelpers', () => ({
  selectId: (...args: unknown[]) => selectId(...args),
}))

const okJsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const payload = {
  name: 'Acme',
  ContactNumber: [{ public_number: '+13173161456' }],
  ContactEmail: [],
}

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

describe('createCloudTalkContact', () => {
  it('returns the id when CloudTalk responds with a string id', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        okJsonResponse({ responseData: { status: 201, data: { id: '1779762076' } } }),
      )

    const { createCloudTalkContact } = await import('./cloudtalk.server')

    expect(await createCloudTalkContact(7, payload)).toBe(1779762076)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('returns the id when CloudTalk responds with a numeric id', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(okJsonResponse({ responseData: { data: { id: 42 } } }))

    const { createCloudTalkContact } = await import('./cloudtalk.server')

    expect(await createCloudTalkContact(7, payload)).toBe(42)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('returns the id from data.Contact.id when present', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      okJsonResponse({ responseData: { data: { Contact: { id: '99' } } } }),
    )

    const { createCloudTalkContact } = await import('./cloudtalk.server')

    expect(await createCloudTalkContact(7, payload)).toBe(99)
  })

  it('falls back to phone search only when the response truly lacks an id', async () => {
    let call = 0
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1
      if (call === 1) return okJsonResponse({ responseData: { data: {} } })
      return okJsonResponse({
        responseData: {
          data: [
            {
              Contact: {
                id: '555',
                ContactNumber: [{ public_number: '+13173161456' }],
              },
            },
          ],
        },
      })
    })

    const { createCloudTalkContact } = await import('./cloudtalk.server')

    expect(await createCloudTalkContact(7, payload)).toBe(555)
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('does not leak the CloudTalk response body into the thrown error message', async () => {
    const pii = 'Jane Doe 555-867-5309 jane@example.com'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(`{"error":"validation","echo":"${pii}"}`, {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { createCloudTalkContact } = await import('./cloudtalk.server')

    const err = (await createCloudTalkContact(7, payload).catch(e => e)) as Error
    expect(err).toBeInstanceOf(Error)
    expect(err.message).not.toContain(pii)
    expect(err.message).toContain('400')
  })

  it('does not leak the unparseable response preview into the thrown error message', async () => {
    const pii = 'Jane Doe 555-867-5309'
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('contacts/add.json')) {
        return okJsonResponse({ responseData: { weird_shape: pii } })
      }
      return okJsonResponse({ responseData: { data: [] } })
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { createCloudTalkContact } = await import('./cloudtalk.server')

    const err = (await createCloudTalkContact(7, payload).catch(e => e)) as Error
    expect(err.message).toContain('unable to resolve contact id')
    expect(err.message).not.toContain(pii)
  })
})

describe('getCloudTalkUSCountryId', () => {
  it('returns the US country id when CloudTalk responds with a string id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      okJsonResponse({
        responseData: {
          data: [{ Country: { id: '233', iso_code: 'US', name: 'United States' } }],
        },
      }),
    )

    const { getCloudTalkUSCountryId } = await import('./cloudtalk.server')

    expect(await getCloudTalkUSCountryId(999)).toBe(233)
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
