import type { LoaderFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { db } from '~/db.server'
import { handleAuthError } from '~/utils/apiResponse.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const userEmail =
      typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''
    const userEmailLike = `%<${userEmail}>`

    const rows = await selectMany<{ c: number }>(
      db,
      `SELECT COUNT(DISTINCT e.thread_id) AS c
       FROM emails e
       LEFT JOIN (
         SELECT thread_id, MAX(deal_id) AS deal_id
         FROM emails
         WHERE deleted_at IS NULL AND thread_id IS NOT NULL AND deal_id IS NOT NULL
         GROUP BY thread_id
       ) td ON td.thread_id = e.thread_id
       LEFT JOIN deals d ON d.id = COALESCE(e.deal_id, td.deal_id) AND d.deleted_at IS NULL
       WHERE e.deleted_at IS NULL
         AND e.thread_id IS NOT NULL
         AND e.sender_user_id IS NULL
         AND e.employee_read_at IS NULL
         AND (
           e.receiver_user_id = ?
           OR d.user_id = ?
           OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1))) = ?
           OR (e.receiver_email NOT LIKE '%<%' AND LOWER(TRIM(e.receiver_email)) = ?)
           OR e.receiver_email LIKE ?
         )`,
      [user.id, user.id, userEmail, userEmail, userEmailLike],
    )
    const count = rows[0]?.c ?? 0
    return data({ count })
  } catch (err) {
    return handleAuthError(err)
  }
}
