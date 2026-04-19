import type { ActionFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    await getEmployeeUser(request)
    const { threadIds } = await request.json()

    if (!Array.isArray(threadIds) || threadIds.length === 0) {
      return { error: 'Invalid threadIds' }
    }

    await db.execute(
      `UPDATE emails
       SET employee_read_at = NOW()
       WHERE deleted_at IS NULL
         AND thread_id IN (${threadIds.map(() => '?').join(',')})
         AND employee_read_at IS NULL
         AND sender_user_id IS NULL`,
      threadIds,
    )

    return { success: true }
  } catch {
    return { error: 'Internal server error' }
  }
}
