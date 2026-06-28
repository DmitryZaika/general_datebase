import type { LoaderFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { db } from '~/db.server'
import { findCustomersByFuzzyName } from '~/utils/customerNameSearch.server'
import { handleAuthError } from '~/utils/apiResponse.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const url = new URL(request.url)
    const term = (url.searchParams.get('term') ?? '').trim().slice(0, 100)
    if (term.length < 2) return data({ customers: [] })

    const digits = term.replace(/\D+/g, '')
    const byName = await findCustomersByFuzzyName(user.company_id, term, 15)
    const seen = new Set(byName.map(c => c.id))
    const merged = [...byName]

    if (digits.length > 0) {
      const byPhone = await selectMany<{
        id: number
        name: string
        phone: string | null
      }>(
        db,
        `SELECT id, name, phone
           FROM customers
          WHERE company_id = ?
            AND deleted_at IS NULL
            AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '(', ''), ')', ''), '-', '') LIKE ?
          ORDER BY name
          LIMIT 10`,
        [user.company_id, `%${digits}%`],
      )
      for (const row of byPhone) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        merged.push({ ...row, company_name: null, phone_2: null })
      }
    }

    const customers = merged.slice(0, 10).map(customer => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? '',
    }))

    return data({ customers })
  } catch (err) {
    return handleAuthError(err)
  }
}
