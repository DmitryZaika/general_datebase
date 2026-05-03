import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import { selectMany } from '~/utils/queryHelpers'

export interface EmailHistory {
  id: number
  thread_id: string
  subject: string
  body: string
  sent_at: string
  read_count: number
  has_attachments?: boolean | number
  sender_user_id: Nullable<number>
  sender_name: Nullable<string>
  employee_read_at: Nullable<string>
}

const EMAIL_HISTORY_SELECT = `SELECT
    e.id,
    e.thread_id,
    e.subject,
    e.body,
    e.sent_at,
    e.sender_user_id,
    u_sender.name AS sender_name,
    e.employee_read_at,
    COUNT(er.message_id) AS read_count,
    (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 AS has_attachments
  FROM emails e
  LEFT JOIN users u_sender ON u_sender.id = e.sender_user_id
  LEFT JOIN email_reads er
    ON e.message_id = er.message_id
   AND er.read_at >= e.sent_at + INTERVAL 5 SECOND`

const EMAIL_HISTORY_GROUP_AND_ORDER = `GROUP BY
    e.id,
    e.thread_id,
    e.subject,
    e.body,
    e.sent_at,
    e.sender_user_id,
    u_sender.name,
    e.employee_read_at
  ORDER BY e.sent_at DESC;`

export async function getDealEmailsWithReads(dealId: number): Promise<EmailHistory[]> {
  return await selectMany<EmailHistory>(
    db,
    `${EMAIL_HISTORY_SELECT}
    WHERE e.deleted_at IS NULL
      AND e.thread_id IS NOT NULL
      AND e.thread_id IN (
        SELECT DISTINCT e2.thread_id
        FROM emails e2
        WHERE e2.deal_id = ?
          AND e2.thread_id IS NOT NULL
          AND e2.deleted_at IS NULL
      )
    ${EMAIL_HISTORY_GROUP_AND_ORDER}`,
    [dealId],
  )
}

export async function getCustomerEmailsWithReads(
  customerEmail: string,
): Promise<EmailHistory[]> {
  return await selectMany<EmailHistory>(
    db,
    `${EMAIL_HISTORY_SELECT}
    WHERE e.deleted_at IS NULL
      AND e.thread_id IS NOT NULL
      AND (
        LOWER(e.sender_email) = LOWER(?)
        OR LOWER(e.receiver_email) = LOWER(?)
      )
    ${EMAIL_HISTORY_GROUP_AND_ORDER}`,
    [customerEmail, customerEmail],
  )
}
