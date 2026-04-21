import { type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { fetchCallsForPhones } from '~/utils/cloudtalk.server'
import { normalizeToE164 } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface DealPhoneRow {
  phone: string | null
  phone_2: string | null
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
  const dealId = parseInt(params.dealId, 10)

  const rows = await selectMany<DealPhoneRow>(
    db,
    `SELECT c.phone, c.phone_2, d.created_at
     FROM deals d
     JOIN customers c ON c.id = d.customer_id
     WHERE d.id = ? AND c.company_id = ? AND d.deleted_at IS NULL`,
    [dealId, companyId],
  )
  const row = rows[0]
  if (!row) return { items: [] }

  const phones = [row.phone, row.phone_2]
    .map(normalizeToE164)
    .filter((p): p is string => !!p)

  const dateFrom = new Date(row.created_at).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  return await fetchCallsForPhones(companyId, phones, {
    date_from: dateFrom,
    date_to: today,
  })
}
