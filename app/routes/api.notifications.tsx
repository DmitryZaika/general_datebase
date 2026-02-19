import type { RowDataPacket } from 'mysql2'
import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface NotificationItem {
  id: string
  title: string
  message: string
  href: string
  sent_at: string
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })
  const userEmail = typeof user.email === 'string' ? user.email : ''

  const [rows] = await db.execute<RowDataPacket[]>(
    `
      SELECT
        e.thread_id,
        COALESCE(e.deal_id, td.deal_id) AS deal_id,
        e.subject,
        DATE_FORMAT(e.sent_at, '%Y-%m-%dT%H:%i:%s') AS sent_at,
        c.name AS customer_name
      FROM emails e
      JOIN (
        SELECT thread_id, MAX(sent_at) AS max_sent_at
        FROM emails
        WHERE deleted_at IS NULL AND thread_id IS NOT NULL AND sender_user_id IS NULL
        GROUP BY thread_id
      ) last_e ON last_e.thread_id = e.thread_id AND last_e.max_sent_at = e.sent_at
      JOIN (
        SELECT thread_id, MAX(deal_id) AS deal_id
        FROM emails
        WHERE deleted_at IS NULL AND thread_id IS NOT NULL AND deal_id IS NOT NULL
        GROUP BY thread_id
      ) td ON td.thread_id = e.thread_id
      JOIN deals d ON d.id = COALESCE(e.deal_id, td.deal_id) AND d.deleted_at IS NULL
      JOIN customers c ON c.id = d.customer_id
      WHERE e.deleted_at IS NULL
        AND e.thread_id IS NOT NULL
        AND e.sender_user_id IS NULL
        AND e.employee_read_at IS NULL
        AND (
          e.receiver_user_id = ?
          OR d.user_id = ?
          OR e.receiver_email = ?
        )
      ORDER BY e.sent_at DESC
      LIMIT 50
    `,
    [user.id, user.id, userEmail],
  )

  const emailNotifications: NotificationItem[] = (rows || [])
    .map(row => {
      const threadId = typeof row.thread_id === 'string' ? row.thread_id : ''
      const dealId = typeof row.deal_id === 'number' ? row.deal_id : 0
      const customerName =
        typeof row.customer_name === 'string' ? row.customer_name : 'Customer'
      const subject = typeof row.subject === 'string' ? row.subject : 'New email'
      const sentAt = typeof row.sent_at === 'string' ? row.sent_at : ''
      if (!threadId || !dealId) return null
      return {
        id: threadId,
        title: customerName,
        message: subject,
        href: `/employee/deals/edit/${dealId}/history/chat/${threadId}`,
        sent_at: sentAt,
      }
    })
    .filter((n): n is NotificationItem => n !== null)

  const dbRows = await selectMany<{
    id: number
    deal_id: number
    message: string
    customer_name: string
    created_at: string
  }>(
    db,
    `SELECT n.id, n.deal_id, n.message,
            c.name AS customer_name,
            DATE_FORMAT(n.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
     FROM notifications n
     JOIN deals d ON d.id = n.deal_id AND d.deleted_at IS NULL
     JOIN customers c ON c.id = d.customer_id
     WHERE n.user_id = ? AND n.is_done = 0 AND n.due_at <= NOW()
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [user.id],
  )

  const activityNotifications: NotificationItem[] = dbRows.map(row => ({
    id: `notif-${row.id}`,
    title: row.customer_name,
    message: row.message,
    href: `/employee/deals/edit/${row.deal_id}/project`,
    sent_at: row.created_at,
  }))

  const notifications = [...emailNotifications, ...activityNotifications].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
  )

  return data(
    { notifications },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}
