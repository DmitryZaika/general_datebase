import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import type { Customer } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const url = new URL(request.url)
  const term = url.searchParams.get('term') || ''

  try {
    const customers = await selectMany<Customer>(
      db,
      `SELECT id, name, address, phone, email, company_name 
       FROM customers 
       WHERE company_id = ? AND name LIKE ? 
       ORDER BY name DESC
       LIMIT 50`,
      [user.company_id, `%${term}%`],
    )

    return data({ customers })
  } catch {
    return data({ error: 'Failed to search customers' }, { status: 500 })
  }
}
