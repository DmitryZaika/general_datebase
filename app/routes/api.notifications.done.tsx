import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

type NotificationKind = 'activity' | 'email'

type NotificationTarget = {
  id: string
  kind: NotificationKind
}

function isNotificationKind(value: unknown): value is NotificationKind {
  return value === 'activity' || value === 'email'
}

function getBodyValue(body: unknown, key: string): unknown {
  if (typeof body !== 'object' || body === null) {
    return undefined
  }
  return Reflect.get(body, key)
}

function parseNotificationTarget(value: unknown): NotificationTarget | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const id = getBodyValue(value, 'id')
  const kind = getBodyValue(value, 'kind')

  if (typeof id !== 'string' || !isNotificationKind(kind)) {
    return null
  }

  return { id, kind }
}

function normalizeTargets(body: unknown): NotificationTarget[] {
  const items = getBodyValue(body, 'items')

  if (Array.isArray(items)) {
    return items
      .map(item => parseNotificationTarget(item))
      .filter((item): item is NotificationTarget => item !== null)
  }

  const id = getBodyValue(body, 'id')
  const kind = getBodyValue(body, 'kind')

  if (typeof id === 'number' && kind === 'activity') {
    return [{ id: `notif-${id}`, kind }]
  }

  if (typeof id === 'string' && isNotificationKind(kind)) {
    return [{ id, kind }]
  }

  return []
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request).catch(() => null)

  if (!user) {
    return data({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const clearAll = getBodyValue(body, 'clearAll') === true

  if (clearAll) {
    await db.query(`UPDATE notifications SET is_done = 1 WHERE user_id = ?`, [user.id])

    await db.execute(
      `
        UPDATE emails e
        LEFT JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL
        SET e.employee_read_at = NOW()
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
      `,
      [
        user.id,
        user.id,
        user.email.trim().toLowerCase(),
        user.email.trim().toLowerCase(),
        `%<${user.email.trim().toLowerCase()}>`,
      ],
    )

    return data({ success: true })
  }

  const targets = normalizeTargets(body)

  if (targets.length === 0) {
    return data({ error: 'notification target required' }, { status: 400 })
  }

  const activityIds = targets
    .filter(target => target.kind === 'activity')
    .map(target => Number(target.id.replace('notif-', '')))
    .filter(id => Number.isInteger(id) && id > 0)

  const emailThreadIds = targets
    .filter(target => target.kind === 'email')
    .map(target => target.id)
    .filter(id => id.length > 0)

  if (activityIds.length > 0) {
    await db.query(
      `UPDATE notifications SET is_done = 1 WHERE user_id = ? AND id IN (${activityIds.map(() => '?').join(',')})`,
      [user.id, ...activityIds],
    )
  }

  if (emailThreadIds.length > 0) {
    await db.execute(
      `
        UPDATE emails e
        LEFT JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL
        SET e.employee_read_at = NOW()
        WHERE e.deleted_at IS NULL
          AND e.thread_id IN (${emailThreadIds.map(() => '?').join(',')})
          AND e.sender_user_id IS NULL
          AND e.employee_read_at IS NULL
          AND (
            e.receiver_user_id = ?
            OR d.user_id = ?
            OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1))) = ?
            OR (e.receiver_email NOT LIKE '%<%' AND LOWER(TRIM(e.receiver_email)) = ?)
            OR e.receiver_email LIKE ?
          )
      `,
      [
        ...emailThreadIds,
        user.id,
        user.id,
        user.email.trim().toLowerCase(),
        user.email.trim().toLowerCase(),
        `%<${user.email.trim().toLowerCase()}>`,
      ],
    )
  }

  return data({ success: true })
}
