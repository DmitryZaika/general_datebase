import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { Pool } from 'mysql2/promise'
import { posthogClient } from '~/utils/posthog.server'

interface ScheduleAutoEmailParams {
  db: Pool
  groupId: number
  companyId: number
  dealId: number
  customerId: number
  userId: number
}

interface AutoTemplate {
  id: number
  hour_delay: number
}

export async function scheduleAutoEmail({
  db,
  groupId,
  companyId,
  dealId,
  customerId,
  userId,
}: ScheduleAutoEmailParams): Promise<void> {
  try {
    const [customerRows] = await db.execute<RowDataPacket[]>(
      'SELECT email FROM customers WHERE id = ? AND deleted_at IS NULL',
      [customerId],
    )
    const customerEmail = customerRows[0]?.email
    if (!customerEmail) return

    const [templateRows] = await db.execute<RowDataPacket[]>(
      `SELECT id, hour_delay
       FROM email_templates
       WHERE lead_group_id = ? AND company_id = ? AND deleted_at IS NULL
         AND hour_delay IS NOT NULL
       LIMIT 1`,
      [groupId, companyId],
    )
    const template = templateRows[0] as AutoTemplate | undefined
    if (!template) return

    const [existingRows] = await db.execute<RowDataPacket[]>(
      `SELECT 1 FROM scheduled_emails
       WHERE deal_id = ? AND template_id = ? AND status = 'pending'
       LIMIT 1`,
      [dealId, template.id],
    )
    if ((existingRows as RowDataPacket[]).length > 0) return

    await db.execute<ResultSetHeader>(
      `INSERT INTO scheduled_emails
         (template_id, deal_id, customer_id, user_id, company_id, send_at, status)
       VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), 'pending')`,
      [template.id, dealId, customerId, userId, companyId, template.hour_delay],
    )
  } catch (error) {
    posthogClient.captureException(error)
  }
}
