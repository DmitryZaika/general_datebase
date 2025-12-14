import type { RowDataPacket } from 'mysql2'
import { type LoaderFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
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

  const [rows] = await db.execute<RowDataPacket[]>(
    `
      SELECT
        e.thread_id,
        e.deal_id,
        e.subject,
        e.sent_at,
        c.name AS customer_name
      FROM emails e
      JOIN (
        SELECT thread_id, MAX(sent_at) AS max_sent_at
        FROM emails
        WHERE deleted_at IS NULL AND thread_id IS NOT NULL
        GROUP BY thread_id
      ) last_e ON last_e.thread_id = e.thread_id AND last_e.max_sent_at = e.sent_at
      JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL
      JOIN customers c ON c.id = d.customer_id
      WHERE e.deleted_at IS NULL
        AND e.thread_id IS NOT NULL
        AND e.deal_id IS NOT NULL
        AND e.sender_user_id IS NULL
        AND e.employee_read_at IS NULL
        AND d.user_id = ?
      ORDER BY e.sent_at DESC
      LIMIT 50
    `,
    [user.id],
  )

  const notifications: NotificationItem[] = (rows || [])
    .map(row => {
      const threadId = typeof row.thread_id === 'string' ? row.thread_id : ''
      const dealId = typeof row.deal_id === 'number' ? row.deal_id : 0
      const customerName = typeof row.customer_name === 'string' ? row.customer_name : 'Customer'
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

  return data(
    { notifications },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}
