import type { ActionFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import {
  badRequest,
  handleAuthError,
  notFound,
  requireEmployeeWithCsrf,
} from '~/utils/apiResponse.server'
import { syncCustomerToCloudTalk } from '~/utils/cloudtalkContactSync.server'
import { formatPhoneForStorage, PHONE_DIGITS_REGEX } from '~/utils/phone'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'

interface CustomerRow {
  id: number
  name: string
  phone: Nullable<string>
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireEmployeeWithCsrf(request)
    const form = await request.formData()
    const phoneDigits = String(form.get('phoneDigits') ?? '')
    const customerId = Number(form.get('customerId') ?? '0')
    if (!PHONE_DIGITS_REGEX.test(phoneDigits)) return badRequest('invalid_phone')
    if (!customerId) return badRequest('invalid_customer_id')

    const rows = await selectMany<CustomerRow>(
      db,
      `SELECT id, name, phone FROM customers
        WHERE id = ? AND company_id = ? AND deleted_at IS NULL
        LIMIT 1`,
      [customerId, user.company_id],
    )
    const customer = rows[0]
    if (!customer) return notFound('customer_not_found')

    const formatted = formatPhoneForStorage(phoneDigits)
    if (!formatted) return badRequest('invalid_phone')
    const phoneColumn = customer.phone ? 'phone_2' : 'phone'
    await db.execute(
      `UPDATE customers SET ${phoneColumn} = ? WHERE id = ? AND company_id = ?`,
      [formatted, customerId, user.company_id],
    )

    // Eagerly upsert into cloudtalk_contacts so subsequent fetchCustomerByPhone
    // joins succeed immediately. Failures here are best-effort — the periodic
    // sync job will retry. Fire-and-forget so the UI gets a fast response.
    void syncCustomerToCloudTalk(customer.id).catch(syncError => {
      posthogClient.captureException(syncError, 'cloudtalk_link_phone_sync_failed', {
        customerId: customer.id,
      })
    })

    return data({ customerId: customer.id, customerName: customer.name })
  } catch (err) {
    return handleAuthError(err)
  }
}
