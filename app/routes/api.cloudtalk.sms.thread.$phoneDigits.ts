import type { LoaderFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { badRequest, handleAuthError } from '~/utils/apiResponse.server'
import {
  fetchCustomerByPhone,
  getThreadForUser,
  getThreadUnreadCountForUser,
  toApiSmsMessage,
} from '~/utils/cloudtalkSmsService.server'
import { clampInt, PHONE_DIGITS_REGEX } from '~/utils/phone'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const phoneDigits = params.phoneDigits ?? ''
    if (!PHONE_DIGITS_REGEX.test(phoneDigits)) return badRequest('invalid_phone')
    const url = new URL(request.url)
    const limit = clampInt(Number(url.searchParams.get('limit') ?? '30'), 1, 200)
    const beforeId = url.searchParams.get('beforeId') ?? undefined

    const result = await getThreadForUser({ user, phoneDigits, limit, beforeId })

    if (result.messages.length === 0) {
      return data({
        thread: null,
        canSend: Boolean(user.cloudtalk_agent_id),
        hasOlder: false,
      })
    }

    const customer = await fetchCustomerByPhone(user.company_id, phoneDigits)
    const unreadCount = await getThreadUnreadCountForUser(user, phoneDigits)

    return data({
      thread: {
        phoneDigits,
        customer,
        messages: result.messages.map(toApiSmsMessage),
        unreadCount,
        assignedToCurrentUser: true,
      },
      canSend: Boolean(user.cloudtalk_agent_id),
      hasOlder: result.hasOlder,
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
