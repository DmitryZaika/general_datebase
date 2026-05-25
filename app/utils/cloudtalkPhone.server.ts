import type mysql from 'mysql2/promise'
import { normalizeCloudTalkAgentId } from '~/utils/cloudtalkPhone'
import { selectMany } from '~/utils/queryHelpers'

export async function fetchCloudTalkAgentId(db: mysql.Pool, userId: number) {
  const rows = await selectMany<{ cloudtalk_agent_id: string | null }>(
    db,
    'SELECT cloudtalk_agent_id FROM users WHERE id = ? AND is_deleted = 0',
    [userId],
  )
  return normalizeCloudTalkAgentId(rows[0]?.cloudtalk_agent_id)
}
