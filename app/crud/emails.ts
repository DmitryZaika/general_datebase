import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

export interface EmailHistory {
  id: number
  thread_id: string
  subject: string
  body: string
  sent_at: string
  read_count: number
  has_attachments?: boolean | number
  sender_user_id: number | null
  employee_read_at: string | null
}

export async function getDealEmailsWithReads(dealId: number): Promise<EmailHistory[]> {
  return await selectMany<EmailHistory>(
    db,
    `SELECT
      e.id,
      e.thread_id,
      e.subject,
      e.body,
      e.sent_at,
      e.sender_user_id,
      e.employee_read_at,
      COUNT(er.message_id) AS read_count,
      (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 AS has_attachments
    FROM emails e
    LEFT JOIN email_reads er
      ON e.message_id = er.message_id
     AND er.read_at >= e.sent_at + INTERVAL 5 SECOND
    WHERE e.deleted_at IS NULL
      AND e.thread_id IS NOT NULL
      AND e.thread_id IN (
        SELECT DISTINCT e2.thread_id
        FROM emails e2
        WHERE e2.deal_id = ?
          AND e2.thread_id IS NOT NULL
          AND e2.deleted_at IS NULL
      )
    GROUP BY
      e.id,
      e.thread_id,
      e.subject,
      e.body,
      e.sent_at,
      e.sender_user_id,
      e.employee_read_at
    ORDER BY e.sent_at DESC;`,
    [dealId],
  )
}

export async function getCustomerEmailsWithReads(
  customerEmail: string,
): Promise<EmailHistory[]> {
  return await selectMany<EmailHistory>(
    db,
    `SELECT
      e.id,
      e.thread_id,
      e.subject,
      e.body,
      e.sent_at,
      e.sender_user_id,
      e.employee_read_at,
      COUNT(er.message_id) AS read_count,
      (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 AS has_attachments
    FROM emails e
    LEFT JOIN email_reads er
      ON e.message_id = er.message_id
     AND er.read_at >= e.sent_at + INTERVAL 5 SECOND
    WHERE e.deleted_at IS NULL
      AND e.thread_id IS NOT NULL
      AND (
        LOWER(e.sender_email) = LOWER(?)
        OR LOWER(e.receiver_email) = LOWER(?)
      )
    GROUP BY
      e.id,
      e.thread_id,
      e.subject,
      e.body,
      e.sent_at,
      e.sender_user_id,
      e.employee_read_at
    ORDER BY e.sent_at DESC;`,
    [customerEmail, customerEmail],
  )
}
