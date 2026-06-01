import { beforeEach, describe, expect, test, vi } from 'vitest'

const { cloudtalkRequestMock } = vi.hoisted(() => ({
  cloudtalkRequestMock: vi.fn(),
}))

vi.mock('./cloudtalk.server', async orig => {
  const actual = await orig<typeof import('./cloudtalk.server')>()
  return { ...actual, cloudtalkRequest: cloudtalkRequestMock }
})

import { CloudTalkApiError } from './cloudtalk.server'
import { mapCloudTalkSendError, sendSmsViaCloudTalk } from './cloudtalkSendSms.server'

const FAKE_KEY = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  cloudtalkRequestMock.mockReset()
})

describe('sendSmsViaCloudTalk', () => {
  test('returns cloudtalkId from response envelope', async () => {
    cloudtalkRequestMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ responseData: { data: { id: 12345 } } }),
    })
    const result = await sendSmsViaCloudTalk({
      companyId: 1,
      agentId: 'agent-A',
      toPhoneE164: '+13173161456',
      text: 'hello',
      idempotencyKey: FAKE_KEY,
    })
    expect(result.cloudtalkId).toBe(12345)
    expect(cloudtalkRequestMock).toHaveBeenCalledWith('sms/send.json', 1, {
      method: 'POST',
      body: { agent_id: 'agent-A', to: '+13173161456', text: 'hello' },
      extraHeaders: { 'Idempotency-Key': FAKE_KEY },
    })
  })

  test('returns null cloudtalkId when response lacks id', async () => {
    cloudtalkRequestMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ responseData: { data: {} } }),
    })
    const result = await sendSmsViaCloudTalk({
      companyId: 1,
      agentId: 'agent-A',
      toPhoneE164: '+13173161456',
      text: 'hello',
      idempotencyKey: FAKE_KEY,
    })
    expect(result.cloudtalkId).toBeNull()
  })

  test('returns cloudtalkId from array-form data', async () => {
    cloudtalkRequestMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ responseData: { data: [{ id: 7777 }] } }),
    })
    const result = await sendSmsViaCloudTalk({
      companyId: 1,
      agentId: 'agent-A',
      toPhoneE164: '+13173161456',
      text: 'hi',
      idempotencyKey: FAKE_KEY,
    })
    expect(result.cloudtalkId).toBe(7777)
  })

  test('returns cloudtalkId from top-level array envelope', async () => {
    cloudtalkRequestMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ responseData: [{ id: 8888 }] }),
    })
    const result = await sendSmsViaCloudTalk({
      companyId: 1,
      agentId: 'agent-A',
      toPhoneE164: '+13173161456',
      text: 'hi',
      idempotencyKey: FAKE_KEY,
    })
    expect(result.cloudtalkId).toBe(8888)
  })

  test('propagates CloudTalkApiError', async () => {
    cloudtalkRequestMock.mockRejectedValueOnce(
      new CloudTalkApiError(429, 'rate limited'),
    )
    await expect(
      sendSmsViaCloudTalk({
        companyId: 1,
        agentId: 'agent-A',
        toPhoneE164: '+13173161456',
        text: 'hello',
        idempotencyKey: FAKE_KEY,
      }),
    ).rejects.toBeInstanceOf(CloudTalkApiError)
  })

  test('throws when CloudTalk returns HTTP 200 with an error envelope', async () => {
    cloudtalkRequestMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        responseData: { status: 406, message: 'Insufficient Funds' },
      }),
    })
    await expect(
      sendSmsViaCloudTalk({
        companyId: 1,
        agentId: 'agent-A',
        toPhoneE164: '+13173161456',
        text: 'hello',
        idempotencyKey: FAKE_KEY,
      }),
    ).rejects.toBeInstanceOf(CloudTalkApiError)
  })
})

describe('mapCloudTalkSendError', () => {
  test('returns cloudtalk_insufficient_funds for "Insufficient Funds"', () => {
    expect(
      mapCloudTalkSendError(new CloudTalkApiError(403, 'x', 'Insufficient Funds')),
    ).toBe('cloudtalk_insufficient_funds')
  })

  test('returns cloudtalk_invalid_phone for "invalid phone number"', () => {
    expect(
      mapCloudTalkSendError(new CloudTalkApiError(400, 'x', 'Invalid phone number')),
    ).toBe('cloudtalk_invalid_phone')
  })

  test('returns cloudtalk_agent_unavailable for agent-related errors', () => {
    expect(
      mapCloudTalkSendError(new CloudTalkApiError(403, 'x', 'Agent not available')),
    ).toBe('cloudtalk_agent_unavailable')
  })

  test('falls back to cloudtalk_<status> for unknown api message', () => {
    expect(
      mapCloudTalkSendError(new CloudTalkApiError(503, 'x', 'Service unavailable')),
    ).toBe('cloudtalk_503')
  })

  test('falls back to cloudtalk_<status> when apiMessage is null', () => {
    expect(mapCloudTalkSendError(new CloudTalkApiError(502, 'x'))).toBe('cloudtalk_502')
  })

  test('returns send_failed for non-CloudTalk errors', () => {
    expect(mapCloudTalkSendError(new Error('boom'))).toBe('send_failed')
  })
})
