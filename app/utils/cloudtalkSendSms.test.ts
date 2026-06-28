import { beforeEach, describe, expect, test, vi } from 'vitest'

const { cloudtalkRequestMock, fetchValueMock } = vi.hoisted(() => ({
  cloudtalkRequestMock: vi.fn(),
  fetchValueMock: vi.fn(),
}))

vi.mock('./cloudtalk.server', async orig => {
  const actual = await orig<typeof import('./cloudtalk.server')>()
  return {
    ...actual,
    cloudtalkRequest: cloudtalkRequestMock,
    fetchValue: fetchValueMock,
  }
})

import { CloudTalkApiError } from './cloudtalk.server'
import {
  getAgentSmsSender,
  mapCloudTalkSendError,
  sendSmsViaCloudTalk,
} from './cloudtalkSendSms.server'

const FAKE_KEY = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  cloudtalkRequestMock.mockReset()
  fetchValueMock.mockReset()
})

describe('getAgentSmsSender', () => {
  // CloudTalk's agents/index.json nests each agent under an `Agent` key.
  test('returns the agent default_number', async () => {
    fetchValueMock.mockResolvedValueOnce({
      items: [
        {
          Agent: {
            id: '540273',
            default_number: '+13175551234',
            associated_numbers: [],
          },
        },
      ],
    })
    expect(await getAgentSmsSender(1, '540273')).toBe('+13175551234')
    expect(fetchValueMock).toHaveBeenCalledWith('agents/index.json', 1, {
      id: '540273',
    })
  })

  test('falls back to the first associated number', async () => {
    fetchValueMock.mockResolvedValueOnce({
      items: [
        {
          Agent: {
            id: '540273',
            default_number: '',
            associated_numbers: ['+13175559999'],
          },
        },
      ],
    })
    expect(await getAgentSmsSender(1, '540273')).toBe('+13175559999')
  })

  test('matches the right agent when the id filter is ignored', async () => {
    fetchValueMock.mockResolvedValueOnce({
      items: [
        {
          Agent: { id: '111', default_number: '+13170000001', associated_numbers: [] },
        },
        {
          Agent: {
            id: '540273',
            default_number: '+13176767938',
            associated_numbers: [],
          },
        },
      ],
    })
    expect(await getAgentSmsSender(1, '540273')).toBe('+13176767938')
  })

  test('returns null when the agent has no number', async () => {
    fetchValueMock.mockResolvedValueOnce({
      items: [{ Agent: { id: '540273', default_number: '', associated_numbers: [] } }],
    })
    expect(await getAgentSmsSender(1, '540273')).toBeNull()
  })

  test('returns null when the agent is not found', async () => {
    fetchValueMock.mockResolvedValueOnce({ items: [] })
    expect(await getAgentSmsSender(1, '999')).toBeNull()
  })
})

describe('sendSmsViaCloudTalk', () => {
  test('returns cloudtalkId from response envelope', async () => {
    cloudtalkRequestMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ responseData: { data: { id: 12345 } } }),
    })
    const result = await sendSmsViaCloudTalk({
      companyId: 1,
      senderE164: '+15555550000',
      toPhoneE164: '+13173161456',
      text: 'hello',
      idempotencyKey: FAKE_KEY,
    })
    expect(result.cloudtalkId).toBe(12345)
    expect(cloudtalkRequestMock).toHaveBeenCalledWith('sms/send.json', 1, {
      method: 'POST',
      body: {
        sender: '+15555550000',
        recipient: '+13173161456',
        message: 'hello',
      },
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
      senderE164: '+15555550000',
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
      senderE164: '+15555550000',
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
      senderE164: '+15555550000',
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
        senderE164: '+15555550000',
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
        senderE164: '+15555550000',
        toPhoneE164: '+13173161456',
        text: 'hello',
        idempotencyKey: FAKE_KEY,
      }),
    ).rejects.toBeInstanceOf(CloudTalkApiError)
  })

  test('throws on the documented success:false envelope', async () => {
    cloudtalkRequestMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        responseData: { success: false, data: 'Unknown number' },
      }),
    })
    await expect(
      sendSmsViaCloudTalk({
        companyId: 1,
        senderE164: '+15555550000',
        toPhoneE164: '+13173161456',
        text: 'hello',
        idempotencyKey: FAKE_KEY,
      }),
    ).rejects.toMatchObject({ apiMessage: 'Unknown number' })
  })

  test('treats success:true as a successful send (no id in payload)', async () => {
    cloudtalkRequestMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        responseData: {
          success: true,
          data: {
            recipient: '+13173161456',
            message: 'hello',
            sender: '+15555550000',
            country_code: 'US',
          },
        },
      }),
    })
    const result = await sendSmsViaCloudTalk({
      companyId: 1,
      senderE164: '+15555550000',
      toPhoneE164: '+13173161456',
      text: 'hello',
      idempotencyKey: FAKE_KEY,
    })
    expect(result.cloudtalkId).toBeNull()
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

  test('maps CloudTalk SMS provider error strings', () => {
    expect(
      mapCloudTalkSendError(new CloudTalkApiError(200, 'x', 'Unknown number')),
    ).toBe('cloudtalk_invalid_phone')
    expect(
      mapCloudTalkSendError(new CloudTalkApiError(200, 'x', 'Not allowed country.')),
    ).toBe('cloudtalk_country_not_allowed')
    expect(
      mapCloudTalkSendError(new CloudTalkApiError(200, 'x', 'Limit exceeded')),
    ).toBe('cloudtalk_limit_exceeded')
    expect(
      mapCloudTalkSendError(
        new CloudTalkApiError(200, 'x', 'Bad number configuration'),
      ),
    ).toBe('cloudtalk_bad_number_config')
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
