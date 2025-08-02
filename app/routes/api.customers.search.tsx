import { data, type LoaderFunctionArgs } from 'react-router'
import z from 'zod'
import { db } from '~/db.server'
import type { Customer } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export const customerSchema = z.object({
  term: z.string(),
  searchType: z.enum(['name', 'phone', 'email']).default('name'),
})

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const url = new URL(request.url)
  const customerData = {
    term: url.searchParams.get('term'),
    searchType: url.searchParams.get('searchType') || 'name',
  }
  let term: string
  let searchType: 'name' | 'phone' | 'email'
  try {
    ;({ term, searchType } = customerSchema.parse(customerData))
  } catch {
    return data({ error: 'Invalid search parameters' }, { status: 422 })
  }

  try {
    const customers = await selectMany<Customer>(
      db,
      `SELECT id, name, address, phone, email, company_name 
       FROM customers 
       WHERE company_id = ? AND ?? LIKE ?
       ORDER BY name DESC
       LIMIT 5`,
      [user.company_id, searchType, `%${term}%`],
    )

    return data({ customers })
  } catch {
    return data({ error: 'Failed to search customers' }, { status: 500 })
  }
}
