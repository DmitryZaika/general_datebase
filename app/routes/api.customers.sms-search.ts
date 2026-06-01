import type { LoaderFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { db } from '~/db.server'
import { handleAuthError } from '~/utils/apiResponse.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const url = new URL(request.url)
    const term = (url.searchParams.get('term') ?? '').trim().slice(0, 100)
    if (term.length < 2) return data({ customers: [] })
    const like = `%${term.toLowerCase()}%`
    const digits = term.replace(/\D+/g, '')
    const rows = await selectMany<{ id: number; name: string; phone: string }>(
      db,
      `SELECT id, name, COALESCE(phone, '') AS phone
         FROM customers
        WHERE company_id = ?
          AND deleted_at IS NULL
          AND (LOWER(name) LIKE ? OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '(', ''), '-', '') LIKE ?)
        ORDER BY name
        LIMIT 10`,
      [user.company_id, like, digits ? `%${digits}%` : '%__no_match__%'],
    )
    return data({ customers: rows })
  } catch (err) {
    return handleAuthError(err)
  }
}
