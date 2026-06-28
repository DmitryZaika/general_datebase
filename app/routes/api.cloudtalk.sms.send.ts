import type { ActionFunctionArgs } from 'react-router'
import { data } from 'react-router'
import {
  badRequest,
  HttpStatus,
  handleAuthError,
  requireEmployeeWithCsrf,
} from '~/utils/apiResponse.server'
import {
  getAgentSmsSender,
  mapCloudTalkSendError,
  sendSmsViaCloudTalk,
} from '~/utils/cloudtalkSendSms.server'
import {
  canUserSendSms,
  finalizeOutboundSms,
  insertPendingOutboundSms,
  toApiSmsMessage,
} from '~/utils/cloudtalkSmsService.server'
import { normalizeToE164, PHONE_DIGITS_REGEX, SMS_MAX_TEXT } from '~/utils/phone'
import { acquireUserSlot } from '~/utils/userRateLimiter.server'

const RATE_LIMIT_PER_MIN = Math.max(
  1,
  Number(process.env.SMS_SEND_RATE_LIMIT_PER_MIN) || 10,
)

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireEmployeeWithCsrf(request)
    if (request.method !== 'POST') return badRequest('method_not_allowed')

    const form = await request.formData()
    const phoneDigits = String(form.get('phoneDigits') ?? '')
    const text = String(form.get('text') ?? '').trim()

    if (!canUserSendSms(user) || !user.cloudtalk_agent_id) {
      return data(
        { success: false, error: 'agent_not_linked' },
        { status: HttpStatus.Forbidden },
      )
    }
    const agentId = user.cloudtalk_agent_id

    if (!PHONE_DIGITS_REGEX.test(phoneDigits)) return badRequest('invalid_phone')
    if (text.length === 0) return badRequest('empty_text')
    if (text.length > SMS_MAX_TEXT) return badRequest('text_too_long')

    const e164 = normalizeToE164(phoneDigits)
    if (!e164) return badRequest('invalid_phone')

    const senderE164 = await getAgentSmsSender(user.company_id, agentId)
    if (!senderE164) return badRequest('agent_no_number')

    // Rate-limit after validation so config errors don't burn slots / mask the failure.
    if (
      !acquireUserSlot({
        userId: user.id,
        capacity: RATE_LIMIT_PER_MIN,
        windowMs: 60_000,
      })
    ) {
      return data({ success: false, error: 'rate_limited' }, { status: 429 })
    }

    // Idempotency-Key (the pending row's UUID) guards against accidental double-sends
    // and traces the SMS in logs/CloudTalk. Retry flows don't reuse it yet.
    const pending = await insertPendingOutboundSms({ user, phoneDigits, text })
    try {
      const sendResult = await sendSmsViaCloudTalk({
        companyId: user.company_id,
        senderE164,
        toPhoneE164: e164,
        text,
        idempotencyKey: pending.idempotencyKey,
      })
      const row = await finalizeOutboundSms({
        id: pending.id,
        status: 'sent',
        cloudtalkId: sendResult.cloudtalkId,
        errorMessage: null,
      })
      return data({ message: toApiSmsMessage(row) })
    } catch (err) {
      const errorToken = mapCloudTalkSendError(err)
      await finalizeOutboundSms({
        id: pending.id,
        status: 'failed',
        cloudtalkId: null,
        errorMessage: errorToken,
      })
      return data(
        { success: false, error: errorToken },
        { status: HttpStatus.BadGateway },
      )
    }
  } catch (err) {
    return handleAuthError(err)
  }
}
