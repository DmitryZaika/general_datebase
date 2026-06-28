import type { ActionFunctionArgs } from 'react-router'
import {
  badRequest,
  handleAuthError,
  requireEmployeeWithCsrf,
  success,
} from '~/utils/apiResponse.server'
import {
  markThreadReadForUser,
  userHasMessagesForPhone,
} from '~/utils/cloudtalkSmsService.server'
import { PHONE_DIGITS_REGEX } from '~/utils/phone'

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireEmployeeWithCsrf(request)
    if (request.method !== 'POST') return badRequest('method_not_allowed')
    const form = await request.formData()
    const phoneDigits = String(form.get('phoneDigits') ?? '')
    if (!PHONE_DIGITS_REGEX.test(phoneDigits)) return badRequest('invalid_phone')
    // Silently no-op when the user can't see any messages for this phone, so
    // mark-read doesn't leak which phones exist in the company.
    const visible = await userHasMessagesForPhone(user, phoneDigits)
    if (!visible) return success()
    await markThreadReadForUser({ user, phoneDigits })
    return success()
  } catch (err) {
    return handleAuthError(err)
  }
}
