import type { Pool } from 'mysql2/promise'
import { selectMany } from '~/utils/queryHelpers'

export type NotificationType =
  | 'activity_added'
  | 'activity_edited'
  | 'activity_deleted'
  | 'note_added'
  | 'note_edited'
  | 'note_deleted'
  | 'comment_added'
  | 'comment_deleted'

export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  activity_added: 'Added an Activity',
  activity_edited: 'Edited an Activity',
  activity_deleted: 'Deleted an Activity',
  note_added: 'Added a Note',
  note_edited: 'Edited a Note',
  note_deleted: 'Deleted a Note',
  comment_added: 'Added a Comment',
  comment_deleted: 'Deleted a Comment',
}

export async function notifyDealAssignee(
  db: Pool,
  dealId: number,
  actorUserId: number,
  actorName: string,
  message: string,
  notificationType: NotificationType,
): Promise<void> {
  try {
    const rows = await selectMany<{ user_id: number | null }>(
      db,
      'SELECT user_id FROM deals WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [dealId],
    )
    const assignedUserId = rows.length > 0 ? rows[0].user_id : null
    if (assignedUserId && assignedUserId !== actorUserId) {
      await db.execute(
        `INSERT INTO notifications (user_id, deal_id, message, notification_type, actor_name, due_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [assignedUserId, dealId, message.slice(0, 255), notificationType, actorName],
      )
    }
  } catch {}
}
