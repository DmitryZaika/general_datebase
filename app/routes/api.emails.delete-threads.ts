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

    // Update deleted_at for all emails in the specified threads
    await db.execute(
      `UPDATE emails SET deleted_at = NOW() WHERE thread_id IN (${threadIds.map(() => '?').join(',')})`,
      threadIds,
    )

    return { success: true }
  } catch {
    return { error: 'Internal server error' }
  }
}
