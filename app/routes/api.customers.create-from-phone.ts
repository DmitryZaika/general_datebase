import type { ActionFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { db } from '~/db.server'
import {
  badRequest,
  handleAuthError,
  requireEmployeeWithCsrf,
} from '~/utils/apiResponse.server'
import { normalizeToE164, PHONE_DIGITS_REGEX } from '~/utils/phone'

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireEmployeeWithCsrf(request)
    const form = await request.formData()
    const phoneDigits = String(form.get('phoneDigits') ?? '')
    const name = String(form.get('name') ?? '')
      .trim()
      .slice(0, 200)
    if (!PHONE_DIGITS_REGEX.test(phoneDigits)) return badRequest('invalid_phone')
    if (name.length < 1) return badRequest('empty_name')

    const e164 = normalizeToE164(phoneDigits)
    const [result] = await db.execute(
      `INSERT INTO customers (company_id, name, phone) VALUES (?, ?, ?)`,
      [user.company_id, name, e164 ?? phoneDigits],
    )
    const customerId = (result as { insertId: number }).insertId
    return data({ customerId, customerName: name })
  } catch (err) {
    return handleAuthError(err)
  }
}
