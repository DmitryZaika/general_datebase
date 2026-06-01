import type { Nullable } from '~/types/utils'
import { CloudTalkApiError, cloudtalkRequest } from './cloudtalk.server'

export interface SendSmsParams {
  companyId: number
  agentId: string
  toPhoneE164: string
  text: string
  idempotencyKey: string
}

export interface SendSmsResult {
  cloudtalkId: Nullable<number>
}

interface SendSmsResponse {
  responseData?:
    | {
        data?: { id?: number } | { id?: number }[]
        status?: number
        message?: string
      }
    | { id?: number; status?: number; message?: string }[]
}

// CloudTalk's success-response envelope is documented inconsistently. We've
// observed `responseData: [{status, message}]` (array-at-top) for error paths;
// list endpoints use `responseData: { data: [...] }`. Until we see a real
// successful send, we tolerate all three shapes and pick the first id we find.
// After the first verified success, the unused branches can be removed.
function extractCloudtalkId(json: SendSmsResponse): Nullable<number> {
  const rd = json.responseData
  if (!rd) return null
  if (Array.isArray(rd)) {
    return rd[0]?.id ?? null
  }
  const data = rd.data
  if (Array.isArray(data)) return data[0]?.id ?? null
  return data?.id ?? null
}

// CloudTalk can return HTTP 200 with an error envelope; treat an explicit error
// status as a failed send so it is not recorded as 'sent'.
function extractSendError(json: SendSmsResponse): Nullable<string> {
  const rd = json.responseData
  const node = Array.isArray(rd) ? rd[0] : rd
  if (node && typeof node === 'object') {
    const status = (node as { status?: unknown }).status
    if (typeof status === 'number' && status >= 400) {
      const message = (node as { message?: unknown }).message
      return typeof message === 'string' && message.length > 0
        ? message
        : `cloudtalk_${status}`
    }
  }
  return null
}

export async function sendSmsViaCloudTalk(
  params: SendSmsParams,
): Promise<SendSmsResult> {
  const response = await cloudtalkRequest('sms/send.json', params.companyId, {
    method: 'POST',
    body: {
      agent_id: params.agentId,
      to: params.toPhoneE164,
      text: params.text,
    },
    extraHeaders: { 'Idempotency-Key': params.idempotencyKey },
  })
  const json = (await response.json()) as SendSmsResponse
  const sendError = extractSendError(json)
  if (sendError !== null) {
    throw new CloudTalkApiError(response.status, 'CloudTalk send error', sendError)
  }
  return { cloudtalkId: extractCloudtalkId(json) }
}

// Map CloudTalk API errors to stable client-facing tokens. The `apiMessage`
// field comes from CloudTalk's response body (parsed in cloudtalkRequest).
export function mapCloudTalkSendError(err: unknown): string {
  if (!(err instanceof CloudTalkApiError)) return 'send_failed'
  const msg = err.apiMessage?.toLowerCase() ?? ''
  if (msg.includes('insufficient funds')) return 'cloudtalk_insufficient_funds'
  if (msg.includes('invalid phone')) return 'cloudtalk_invalid_phone'
  if (msg.includes('agent')) return 'cloudtalk_agent_unavailable'
  return `cloudtalk_${err.status}`
}
