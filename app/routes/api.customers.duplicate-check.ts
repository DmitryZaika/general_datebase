import { data, type LoaderFunctionArgs } from 'react-router'
import z from 'zod'
import { db } from '~/db.server'
import { canonicalPhone10 } from '~/utils/phone'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

const querySchema = z.object({
  phone: z.string().optional(),
  phone_2: z.string().optional(),
  email: z.string().optional(),
})

function phoneLast10(value: string | undefined): string | null {
  if (!value?.trim()) return null
  const digits = canonicalPhone10(value)
  return digits.length >= 10 ? digits : null
}

function phoneColumnLast10(column: string): string {
  return `RIGHT(REGEXP_REPLACE(COALESCE(${column}, ''), '[^0-9]', ''), 10)`
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const url = new URL(request.url)
  const phone = url.searchParams.get('phone') || undefined
  const phone2 = url.searchParams.get('phone_2') || undefined
  const email = url.searchParams.get('email') || undefined

  let parsed: z.infer<typeof querySchema>
  try {
    parsed = querySchema.parse({ phone, phone_2: phone2, email })
  } catch (error) {
    posthogClient.captureException(error)
    return data({ error: 'Invalid parameters' }, { status: 422 })
  }

  const phoneLast10Values = [phoneLast10(parsed.phone), phoneLast10(parsed.phone_2)].filter(
    (v): v is string => v !== null,
  )

  if (phoneLast10Values.length === 0 && !parsed.email) {
    posthogClient.captureException(new Error('No phone or email provided'))
    return data({ matches: [] })
  }

  const contactConds: string[] = []
  const params: Array<string | number> = [user.company_id]

  for (const last10 of phoneLast10Values) {
    contactConds.push(`(
      ${phoneColumnLast10('c.phone')} = ?
      OR ${phoneColumnLast10('c.phone_2')} = ?
    )`)
    params.push(last10, last10)
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
