import type { Pool } from 'mysql2/promise'
import { selectMany } from '~/utils/queryHelpers'

export type NotificationType =
  | 'activity_added'
  | 'activity_edited'
  | 'activity_deleted'
  | 'activity_deadline_reminder'
  | 'note_added'
  | 'note_edited'
  | 'note_deleted'
  | 'comment_added'
  | 'comment_deleted'

export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  activity_added: 'Added an Activity',
  activity_edited: 'Edited an Activity',
  activity_deleted: 'Deleted an Activity',
  activity_deadline_reminder: 'Activity Reminder',
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
  } catch {
    void 0
  }
}

function isoToMysqlUtc(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

export async function scheduleActivityDeadlineReminder(
  db: Pool,
  dealId: number,
  actorUserId: number,
  activityName: string,
  deadlineUtcIso: string | null,
  oldActivityName?: string,
): Promise<void> {
  try {
    const rows = await selectMany<{ user_id: number | null }>(
      db,
      'SELECT user_id FROM deals WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [dealId],
    )
    const assignedUserId = rows.length > 0 ? rows[0].user_id : null
    const targetUserId = assignedUserId || actorUserId

    const nameToClean = oldActivityName ?? activityName
    await db.execute(
      `DELETE FROM notifications
       WHERE deal_id = ? AND notification_type = 'activity_deadline_reminder'
         AND message = ? AND is_done = 0`,
      [dealId, nameToClean.slice(0, 255)],
    )

    if (!deadlineUtcIso) return
    const dueAt = isoToMysqlUtc(deadlineUtcIso)
    if (!dueAt) return

    await db.execute(
      `INSERT INTO notifications (user_id, deal_id, message, notification_type, actor_name, due_at)
       VALUES (?, ?, ?, 'activity_deadline_reminder', NULL, ?)`,
      [targetUserId, dealId, activityName.slice(0, 255), dueAt],
    )
  } catch {
    void 0
  }
}
