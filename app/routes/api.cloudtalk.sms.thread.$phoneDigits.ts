import type { LoaderFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { badRequest, handleAuthError } from '~/utils/apiResponse.server'
import {
  canUserSendSms,
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
    const customer = await fetchCustomerByPhone(user.company_id, phoneDigits)

    // Empty thread: return a non-null thread so the pane renders a composer for a
    // brand-new conversation; the first send creates it.
    if (result.messages.length === 0) {
      return data({
        thread: {
          phoneDigits,
          customer,
          messages: [],
          unreadCount: 0,
          assignedToCurrentUser: true,
        },
        canSend: canUserSendSms(user),
        hasOlder: false,
      })
    }

    const unreadCount = await getThreadUnreadCountForUser(user, phoneDigits)

    return data({
      thread: {
        phoneDigits,
        customer,
        messages: result.messages.map(toApiSmsMessage),
        unreadCount,
        assignedToCurrentUser: true,
      },
      canSend: canUserSendSms(user),
      hasOlder: result.hasOlder,
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
