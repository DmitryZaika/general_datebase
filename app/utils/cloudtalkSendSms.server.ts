import type { Nullable } from '~/types/utils'
import {
  type Agent,
  CloudTalkApiError,
  cloudtalkRequest,
  fetchValue,
} from './cloudtalk.server'

export interface SendSmsParams {
  companyId: number
  senderE164: string
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
        success?: boolean | string
        data?: { id?: number } | { id?: number }[] | string | null
        status?: number
        message?: string
        id?: number
      }
    | { id?: number; status?: number; message?: string }[]
}

// sms/send.json success data has no message id today; tolerate the legacy list shapes
// in case one ever appears (used for inbound-echo dedupe).
function extractCloudtalkId(json: SendSmsResponse): Nullable<number> {
  const rd = json.responseData
  if (!rd) return null
  if (Array.isArray(rd)) return rd[0]?.id ?? null
  const data = rd.data
  if (Array.isArray(data)) return data[0]?.id ?? null
  if (data && typeof data === 'object') {
    return (data as { id?: number }).id ?? null
  }
  return rd.id ?? null
}

// A failed send comes back as HTTP 200 with `responseData.success = false` and `data`
// holding the provider error — detect it (plus the legacy status>=400 shape) as failure.
function extractSendError(json: SendSmsResponse): Nullable<string> {
  const rd = json.responseData
  if (!rd) return null
  if (Array.isArray(rd)) {
    const node = rd[0]
    if (node && typeof node.status === 'number' && node.status >= 400) {
      return node.message && node.message.length > 0
        ? node.message
        : `cloudtalk_${node.status}`
    }
    return null
  }
  if (rd.success === false || rd.success === 'false') {
    return typeof rd.data === 'string' && rd.data.length > 0
      ? rd.data
      : 'sms_send_failed'
  }
  if (typeof rd.status === 'number' && rd.status >= 400) {
    return rd.message && rd.message.length > 0 ? rd.message : `cloudtalk_${rd.status}`
  }
  return null
}

// Resolve the SMS sender from the agent's own CloudTalk number, looked up by agent id —
// CloudTalk owns each agent's number(s), so nothing is stored on our side. Prefers the
// agent's default outbound number, falling back to the first assigned number. Returns
// null when the agent has no number configured in CloudTalk. CloudTalk's agents/index.json
// nests each row under an `Agent` key, so we unwrap it and match by id defensively (in
// case the `id` filter is ignored and all agents are returned).
export async function getAgentSmsSender(
  companyId: number,
  agentId: string,
): Promise<Nullable<string>> {
  const { items } = await fetchValue<{ Agent: Agent }>('agents/index.json', companyId, {
    id: agentId,
  })
  const agent = items.find(item => String(item.Agent?.id) === agentId)?.Agent
  if (!agent) return null
  const sender = agent.default_number?.trim() || agent.associated_numbers?.[0]?.trim()
  return sender && sender.length > 0 ? sender : null
}

export async function sendSmsViaCloudTalk(
  params: SendSmsParams,
): Promise<SendSmsResult> {
  const response = await cloudtalkRequest('sms/send.json', params.companyId, {
    method: 'POST',
    body: {
      sender: params.senderE164,
      recipient: params.toPhoneE164,
      message: params.text,
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

// Map CloudTalk errors to stable client-facing tokens.
export function mapCloudTalkSendError(err: unknown): string {
  if (!(err instanceof CloudTalkApiError)) return 'send_failed'
  const msg = err.apiMessage?.toLowerCase() ?? ''
  if (msg.includes('insufficient funds')) return 'cloudtalk_insufficient_funds'
  if (msg.includes('limit exceeded')) return 'cloudtalk_limit_exceeded'
  if (msg.includes('not allowed country')) return 'cloudtalk_country_not_allowed'
  if (msg.includes('unknown number') || msg.includes('invalid phone')) {
    return 'cloudtalk_invalid_phone'
  }
  if (msg.includes('bad number configuration')) return 'cloudtalk_bad_number_config'
  if (msg.includes('agent')) return 'cloudtalk_agent_unavailable'
  return `cloudtalk_${err.status}`
}
