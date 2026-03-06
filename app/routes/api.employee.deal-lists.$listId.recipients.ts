import { data, type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const listId = parseInt(params.listId ?? '0', 10)
    if (!listId) return data({ emails: [] })

    const rows = await selectMany<{ email: string; name: string | null }>(
      db,
      `SELECT DISTINCT c.email, c.name
       FROM customers c
       INNER JOIN deals d ON d.customer_id = c.id AND d.deleted_at IS NULL AND d.list_id = ?
       WHERE c.sales_rep = ? AND c.deleted_at IS NULL AND c.email IS NOT NULL AND TRIM(c.email) != ''
       ORDER BY c.email`,
      [listId, user.id],
    )
    const recipients = rows
      .map(r => ({
        email: r.email.trim().toLowerCase(),
        name: r.name?.trim() || null,
      }))
      .filter(r => r.email)
    const seen = new Set<string>()
    const unique = recipients.filter(r => {
      if (seen.has(r.email)) return false
      seen.add(r.email)
      return true
    })
    return data({ recipients: unique })
  } catch {
    return redirect('/login')
  }
}
