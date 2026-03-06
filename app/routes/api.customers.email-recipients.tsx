import { data, type LoaderFunctionArgs } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

const schema = z.object({
  term: z.string().trim().min(1),
})

type RecipientCustomer = {
  id: number
  name: string
  email: string
  company_name: string | null
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const url = new URL(request.url)

  const parsed = schema.safeParse({
    term: url.searchParams.get('term') || '',
  })

  if (!parsed.success) {
    return data({ customers: [] })
  }

  const term = parsed.data.term
  const prefix = `${term}%`
  const like = `%${term}%`

  const customers = await selectMany<RecipientCustomer>(
    db,
    `SELECT c.id, c.name, c.email, c.company_name
     FROM customers c
     WHERE c.company_id = ?
       AND c.deleted_at IS NULL
       AND c.email IS NOT NULL
       AND c.email != ''
       AND (
         c.name LIKE ?
         OR c.email LIKE ?
         OR (c.company_name IS NOT NULL AND c.company_name LIKE ?)
       )
     ORDER BY
       CASE
         WHEN c.email LIKE ? THEN 0
         WHEN c.name LIKE ? THEN 1
         WHEN c.company_name LIKE ? THEN 2
         ELSE 3
       END,
       c.name ASC
     LIMIT 15`,
    [user.company_id, like, like, like, prefix, prefix, prefix],
  )

  const uniqueCustomers = customers.filter((customer, index, array) => {
    return array.findIndex(item => item.email === customer.email) === index
  })

  return data({ customers: uniqueCustomers })
}
