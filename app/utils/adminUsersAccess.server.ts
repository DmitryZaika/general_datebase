import { db } from '~/db.server'
import { Positions } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import type { SessionUser } from '~/utils/session.server'

export async function canEditAdminUsers(user: SessionUser): Promise<boolean> {
  if (user.is_superuser) return true
  const rows = await selectMany<{ position_id: number }>(
    db,
    `SELECT up.position_id
       FROM users_positions up
      WHERE up.user_id = ?
        AND up.company_id = ?
        AND up.position_id = ?`,
    [user.id, user.company_id, Positions.Manager],
  )
  return rows.length > 0
}

export async function canManageCompanySettings(user: SessionUser): Promise<boolean> {
  return canEditAdminUsers(user)
}
