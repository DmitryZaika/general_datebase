import { type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import { fetchSmsForCompanyAndPhones } from '~/utils/cloudtalkSms.server'
import { phoneDigitsOnly } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface DealPhoneRow {
  phone: Nullable<string>
  phone_2: Nullable<string>
  created_at: string
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  let companyId: number
  try {
    const user = await getEmployeeUser(request)
    companyId = user.company_id
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.dealId) {
    throw new Response(null, { status: 422, statusText: 'Missing dealId' })
  }
  const dealId = Number.parseInt(params.dealId, 10)

  const rows = await selectMany<DealPhoneRow>(
    db,
    `SELECT c.phone, c.phone_2, d.created_at
       FROM deals d
       JOIN customers c ON c.id = d.customer_id
      WHERE d.id = ? AND c.company_id = ? AND d.deleted_at IS NULL`,
    [dealId, companyId],
  )
  const row = rows[0]
  if (!row) return { items: [], customerPhoneDigits: [] }

  const phoneDigits = [row.phone, row.phone_2]
    .filter((p): p is string => !!p)
    .map(phoneDigitsOnly)
    .filter(d => d.length >= 10)

  const result = await fetchSmsForCompanyAndPhones({
    companyId,
    phoneDigits,
    createdAfter: new Date(row.created_at),
  })
  return { ...result, customerPhoneDigits: phoneDigits }
}
