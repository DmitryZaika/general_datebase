import type { Pool } from 'mysql2/promise'
import { selectMany } from '~/utils/queryHelpers'

export type ScheduledEmailStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

export interface ScheduledEmailWithDetails {
  id: number
  send_at: string
  status: ScheduledEmailStatus
  created_at: string
  sent_at: string | null
  error_message: string | null
  template_name: string
  customer_name: string
  customer_email: string
  sales_rep_name: string
}

export function getScheduledEmailsByCompany(db: Pool, companyId: number) {
  return selectMany<ScheduledEmailWithDetails>(
    db,
    `SELECT se.id, se.send_at, se.status, se.created_at,
            se.sent_at, se.error_message,
            et.template_name,
            c.name AS customer_name, c.email AS customer_email,
            u.name AS sales_rep_name
     FROM scheduled_emails se
     JOIN email_templates et ON se.template_id = et.id
     JOIN customers c ON se.customer_id = c.id
     JOIN users u ON se.user_id = u.id
     WHERE se.company_id = ?
     ORDER BY se.created_at DESC
     LIMIT 100`,
    [companyId],
  )
}

export async function cancelScheduledEmail(
  db: Pool,
  scheduledEmailId: number,
  companyId: number,
) {
  await db.execute(
    `UPDATE scheduled_emails
     SET status = 'cancelled'
     WHERE id = ? AND company_id = ? AND status = 'pending'`,
    [scheduledEmailId, companyId],
  )
}
