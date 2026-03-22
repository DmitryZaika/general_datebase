import type { RowDataPacket } from 'mysql2'
import { data, type LoaderFunctionArgs } from 'react-router'
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
  const userEmail =
    typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''
  const userEmailLike = `%<${userEmail}>`

  const [rows] = await db.execute<RowDataPacket[]>(
    `
      SELECT
        e.thread_id,
        COALESCE(e.deal_id, td.deal_id) AS deal_id,
        e.subject,
        e.sent_at,
        e.sender_email,
        c.name AS customer_name
      FROM emails e
      JOIN (
        SELECT thread_id, MAX(sent_at) AS max_sent_at
        FROM emails
        WHERE deleted_at IS NULL AND thread_id IS NOT NULL AND sender_user_id IS NULL
        GROUP BY thread_id
      ) last_e ON last_e.thread_id = e.thread_id AND last_e.max_sent_at = e.sent_at
      LEFT JOIN (
        SELECT thread_id, MAX(deal_id) AS deal_id
        FROM emails
        WHERE deleted_at IS NULL AND thread_id IS NOT NULL AND deal_id IS NOT NULL
        GROUP BY thread_id
      ) td ON td.thread_id = e.thread_id
      LEFT JOIN deals d ON d.id = COALESCE(e.deal_id, td.deal_id) AND d.deleted_at IS NULL
      LEFT JOIN customers c ON c.id = d.customer_id
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
        )
      ORDER BY e.sent_at DESC
      LIMIT 50
    `,
    [user.id, user.id, userEmail, userEmail, userEmailLike],
  )

  const notifications: NotificationItem[] = (rows || [])
    .map(row => {
      const threadId = typeof row.thread_id === 'string' ? row.thread_id : ''
      if (!threadId) return null

      const dealId = typeof row.deal_id === 'number' ? row.deal_id : 0
      const customerName =
        typeof row.customer_name === 'string' ? row.customer_name : ''
      const senderEmail = typeof row.sender_email === 'string' ? row.sender_email : ''
      const subject = typeof row.subject === 'string' ? row.subject : 'New email'
      const sentAt = typeof row.sent_at === 'string' ? row.sent_at : ''

      const title = customerName || senderEmail || 'New email'
      const href = dealId
        ? `/employee/deals/edit/${dealId}/history/chat/${threadId}`
        : `/employee/emails/chat/${threadId}`

      return { id: threadId, title, message: subject, href, sent_at: sentAt }
    })
    .filter((n): n is NotificationItem => n !== null)

  return data(
    { notifications },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}
