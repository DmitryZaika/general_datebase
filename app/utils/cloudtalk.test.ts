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

beforeEach(() => {
  selectId.mockReset()
  selectId.mockResolvedValue({
    cloudtalk_access_key: 'key',
    cloudtalk_access_secret: 'secret',
  })
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
