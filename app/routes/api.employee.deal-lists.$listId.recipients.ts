import { data, type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const listId = parseInt(params.listId ?? '0', 10)
    if (!listId) return data({ emails: [] })

    const url = new URL(request.url)
    const includeWon = url.searchParams.get('won') === '1'
    const includeLost = url.searchParams.get('lost') === '1'

    const conditions: string[] = ['d.deleted_at IS NULL', 'd.list_id = ?']
    const params_arr: (number | string)[] = [listId]

    if (includeWon && includeLost) {
      conditions.push('(d.is_won IS NULL OR d.is_won = 1 OR d.is_won = 0)')
    } else if (includeWon) {
      conditions.push('(d.is_won IS NULL OR d.is_won = 1)')
    } else if (includeLost) {
      conditions.push('(d.is_won IS NULL OR d.is_won = 0)')
    } else {
      conditions.push('d.is_won IS NULL')
    }

    params_arr.push(user.id)

    const rows = await selectMany<{ email: string; name: string | null }>(
      db,
      `SELECT DISTINCT c.email, c.name
       FROM customers c
       INNER JOIN deals d ON d.customer_id = c.id AND ${conditions.join(' AND ')}
       WHERE c.sales_rep = ? AND c.deleted_at IS NULL AND c.email IS NOT NULL AND TRIM(c.email) != ''
       ORDER BY c.email`,
      params_arr,
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
