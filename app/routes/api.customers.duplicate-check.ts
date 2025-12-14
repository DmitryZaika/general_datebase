import { data, type LoaderFunctionArgs } from 'react-router'
import z from 'zod'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

const querySchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
})

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const url = new URL(request.url)
  const phone = url.searchParams.get('phone') || undefined
  const email = url.searchParams.get('email') || undefined

  let parsed: z.infer<typeof querySchema>
  try {
    parsed = querySchema.parse({ phone, email })
  } catch {
    return data({ error: 'Invalid parameters' }, { status: 422 })
  }

  if (!parsed.phone && !parsed.email) {
    return data({ matches: [] })
  }

  const contactConds: string[] = []
  const params: Array<string | number> = [user.company_id]

  if (parsed.phone) {
    contactConds.push('c.phone = ?')
    params.push(parsed.phone)
  }
  if (parsed.email) {
    contactConds.push('c.email = ?')
    params.push(parsed.email)
  }

  const where = `WHERE c.company_id = ? AND (${contactConds.join(' OR ')}) AND c.deleted_at IS NULL`

  const rows = await selectMany<{
    id: number
    name: string
    phone: string | null
    email: string | null
    sales_rep_name: string | null
  }>(
    db,
    `SELECT c.id, c.name, c.phone, c.email, u.name AS sales_rep_name
       FROM customers c
       LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
       ${where}
       LIMIT 5`,
    params,
  )

  return data({ matches: rows })
}
