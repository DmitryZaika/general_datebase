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
    const like = `%${term}%`
    const prefixLike = `${term}%`
    const wordLike = `% ${term} %`

    let customers: Customer[] = []

    if (searchType === 'name') {
      const words = term.trim().split(/\s+/).filter(w => w.length > 0)

      let nameCondition = 'c.name LIKE ?'
      const nameParams: string[] = [like]

      if (words.length > 1) {
        const parts = words.map(() => 'c.name LIKE ?').join(' AND ')
        nameCondition = `(c.name LIKE ? OR (${parts}))`
        const wordParams = words.map(w => `%${w}%`)
        nameParams.splice(0, nameParams.length, like, ...wordParams)
      }

      customers = await selectMany<Customer>(
        db,
        `SELECT DISTINCT c.id, c.name, c.address, c.phone, c.email, c.company_name
         FROM customers c
         LEFT JOIN deals d ON d.customer_id = c.id AND d.user_id = ? AND d.deleted_at IS NULL
         WHERE c.company_id = ? AND c.deleted_at IS NULL
           AND ${nameCondition}
         ORDER BY
           CASE
             WHEN d.id IS NOT NULL THEN 0
             WHEN c.sales_rep = ? THEN 1
             ELSE 2
           END,
           CASE
             WHEN c.name LIKE ? THEN 0
             WHEN c.name LIKE ? THEN 1
             ELSE 2
           END,
           c.name ASC
         LIMIT 15`,
        [user.id, user.company_id, ...nameParams, user.id, prefixLike, wordLike],
      )
    } else {
      customers = await selectMany<Customer>(
        db,
        `SELECT DISTINCT c.id, c.name, c.address, c.phone, c.email, c.company_name
         FROM customers c
         LEFT JOIN deals d ON d.customer_id = c.id AND d.user_id = ? AND d.deleted_at IS NULL
         WHERE c.company_id = ? AND c.deleted_at IS NULL
           AND ?? LIKE ?
         ORDER BY
           CASE
             WHEN d.id IS NOT NULL THEN 0
             WHEN c.sales_rep = ? THEN 1
             ELSE 2
           END,
           CASE
             WHEN ?? LIKE ? THEN 0
             WHEN ?? LIKE ? THEN 1
             ELSE 2
           END,
           c.name ASC
         LIMIT 15`,
        [
          user.id,
          user.company_id,
          searchType,
          like,
          user.id,
          searchType,
          prefixLike,
          searchType,
          wordLike,
        ],
      )
    }

    return data({ customers })
  } catch {
    return data({ error: 'Failed to search customers' }, { status: 500 })
  }
}
