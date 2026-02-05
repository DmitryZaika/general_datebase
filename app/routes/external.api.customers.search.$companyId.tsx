import { data, type LoaderFunctionArgs } from 'react-router'
import z from 'zod'
import { db } from '~/db.server'
import type { Customer } from '~/types'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { getMarketingUser } from '~/utils/session.server'

const customerSchema = z.object({
  term: z.string(),
  searchType: z.enum(['name', 'phone', 'email']).prefault('name'),
})

export async function loader({ request, params }: LoaderFunctionArgs) {
  const companyId = Number(params.companyId)
  if (!Number.isFinite(companyId) || companyId <= 0) {
    posthogClient.captureException(new Error('Invalid company ID'))
    return data({ customers: [] })
  }
  try {
    await getMarketingUser(request, companyId)
  } catch (error) {
    posthogClient.captureException(error)
    return data({ customers: [] }, { status: 401 })
  }

  const url = new URL(request.url)
  const customerData = {
    term: url.searchParams.get('term'),
    searchType: url.searchParams.get('searchType') || 'name',
  }
  let term: string
  let searchType: 'name' | 'phone' | 'email'
  try {
    ;({ term, searchType } = customerSchema.parse(customerData))
  } catch (error) {
    posthogClient.captureException(error, 'Invalid search parameters', { customerData })
    return data({ error: 'Invalid search parameters' }, { status: 422 })
  }

  try {
    const like = `%${term}%`
    const prefixLike = `${term}%`
    const wordLike = `% ${term} %`

    const customers = await selectMany<Customer>(
      db,
      `SELECT id, name, address, phone, email, company_name
       FROM customers
       WHERE company_id = ? AND deleted_at IS NULL
         AND ?? LIKE ?
       ORDER BY
         CASE
           WHEN ?? LIKE ? THEN 0
           WHEN ?? LIKE ? THEN 1
           ELSE 2
         END,
         name ASC
       LIMIT 5`,
      [companyId, searchType, like, searchType, prefixLike, searchType, wordLike],
    )

    return data({ customers })
  } catch (error) {
    posthogClient.captureException(error, 'Failed to search customers', { companyId })
    return data({ error: 'Failed to search customers' }, { status: 500 })
  }
}
