import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

export interface EmailHistory {
  id: number
  thread_id: string
  subject: string
  body: string
  sent_at: string
  read_count: number
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
      COUNT(er.message_id) AS read_count
    FROM emails e
    LEFT JOIN email_reads er
      ON e.message_id = er.message_id
     AND er.read_at >= e.sent_at + INTERVAL 5 SECOND
    WHERE e.deleted_at IS NULL
      AND e.deal_id = ?
    GROUP BY
      e.id,
      e.thread_id,
      e.subject,
      e.body,
      e.sent_at
    ORDER BY e.sent_at DESC;`,
    [dealId],
  )
}
