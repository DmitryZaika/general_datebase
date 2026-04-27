import type { RowDataPacket } from 'mysql2'
import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import {
  NOTIFICATION_TITLES,
  type NotificationType,
} from '~/lib/dealNotification.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface NotificationItem {
  id: string
  title: string
  message: string
  href: string
  sent_at: string
  kind: 'email' | 'activity'
  notification_type?: NotificationType
  actor_name?: string
  customer_name?: string
  type_title?: string
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
        DATE_FORMAT(e.sent_at, '%Y-%m-%dT%H:%i:%sZ') AS sent_at,
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

  const emailNotifications: NotificationItem[] = (rows || [])
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
        ? `/employee/deals/edit/${dealId}/project/chat/${threadId}`
        : `/employee/emails/chat/${threadId}`

      return {
        id: threadId,
        title,
        message: subject,
        href,
        sent_at: sentAt,
        kind: 'email',
      }
    })
    .filter((n): n is NotificationItem => n !== null)

  const dbRows = await selectMany<{
    id: number
    deal_id: number
    message: string
    customer_name: string
    created_at: string
    notification_type: string | null
    actor_name: string | null
  }>(
    db,
    `SELECT n.id, n.deal_id, n.message,
            c.name AS customer_name,
            n.notification_type, n.actor_name,
            DATE_FORMAT(n.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
     FROM notifications n
     JOIN deals d ON d.id = n.deal_id AND d.deleted_at IS NULL
     JOIN customers c ON c.id = d.customer_id
     WHERE n.user_id = ? AND n.is_done = 0
       AND CASE
         WHEN n.notification_type = 'activity_deadline_reminder' THEN n.due_at <= UTC_TIMESTAMP()
         ELSE n.due_at <= NOW()
       END
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [user.id],
  )

  const activityNotifications: NotificationItem[] = dbRows.map(row => {
    const nType = row.notification_type as NotificationType | null
    const typeTitle = nType ? NOTIFICATION_TITLES[nType] : undefined
    return {
      id: `notif-${row.id}`,
      title: row.customer_name,
      message: row.message,
      href: `/employee/deals/edit/${row.deal_id}/project`,
      sent_at: row.created_at,
      kind: 'activity',
      notification_type: nType ?? undefined,
      actor_name: row.actor_name ?? undefined,
      customer_name: row.customer_name,
      type_title: typeTitle,
    }
  })

  const notifications = [...emailNotifications, ...activityNotifications].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
  )

  return data(
    { notifications },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}
