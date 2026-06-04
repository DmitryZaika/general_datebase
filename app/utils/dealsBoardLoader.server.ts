import type { Pool } from 'mysql2/promise'
import { selectMany } from '~/utils/queryHelpers'

export type DealsBoardMaps = {
  imagesMap: Record<number, boolean>
  emailsMap: Record<number, boolean>
  nearestActivityMap: Record<
    number,
    { id: number; name: string; deadline: string | null; priority: string }
  >
  activitiesMap: Record<number, boolean>
  activitiesIconMap: Record<number, 'red' | 'yellow' | 'gray'>
  notesMap: Record<number, boolean>
}

export function emptyDealsBoardMaps(): DealsBoardMaps {
  return {
    imagesMap: {},
    emailsMap: {},
    nearestActivityMap: {},
    activitiesMap: {},
    activitiesIconMap: {},
    notesMap: {},
  }
}

function sqlIn(count: number): string {
  return Array(count).fill('?').join(', ')
}

export async function loadGroupIdsWithOverdueActivities(
  db: Pool,
  userId: number,
  companyId: number,
  groupIds: number[],
  isWon: number | null,
): Promise<number[]> {
  if (groupIds.length === 0) return []

  const groupIn = sqlIn(groupIds.length)
  let isWonClause = 'AND d.is_won IS NULL'
  if (isWon === 1) isWonClause = 'AND d.is_won = 1'
  else if (isWon === 0) isWonClause = 'AND d.is_won = 0'

  const rows = await selectMany<{ group_id: number }>(
    db,
    `SELECT DISTINCT dl.group_id
     FROM deal_activities da
     INNER JOIN deals d ON d.id = da.deal_id
     INNER JOIN deals_list dl ON dl.id = d.list_id AND dl.deleted_at IS NULL
     WHERE da.deleted_at IS NULL
       AND da.is_completed = 0
       AND da.company_id = ?
       AND d.deleted_at IS NULL
       AND d.user_id = ?
       AND dl.group_id IN (${groupIn})
       ${isWonClause}
       AND da.deadline IS NOT NULL
       AND DATE(da.deadline) < CURDATE()`,
    [companyId, userId, ...groupIds],
  )

  return rows.map(row => row.group_id)
}

export async function loadDealsBoardMaps(
  db: Pool,
  dealIds: number[],
  companyId: number,
): Promise<DealsBoardMaps> {
  if (dealIds.length === 0) {
    return emptyDealsBoardMaps()
  }

  const inList = sqlIn(dealIds.length)

  const [
    imagesCounts,
    emailCounts,
    nearestActivities,
    activitiesCounts,
    activitiesDeadlines,
    notesCounts,
  ] = await Promise.all([
    selectMany<{ deal_id: number; count: number }>(
      db,
      `SELECT deal_id, COUNT(*) as count FROM deals_images WHERE deal_id IN (${inList}) GROUP BY deal_id`,
      dealIds,
    ),
    selectMany<{ deal_id: number; count: number }>(
      db,
      `SELECT deal_id, COUNT(*) as count FROM emails WHERE deleted_at IS NULL AND deal_id IN (${inList}) GROUP BY deal_id`,
      dealIds,
    ),
    selectMany<{
      id: number
      deal_id: number
      name: string
      deadline: string | null
      priority: string
    }>(
      db,
      `SELECT id, deal_id, name, priority, DATE_FORMAT(deadline, '%Y-%m-%dT%H:%i:%sZ') AS deadline
       FROM deal_activities
       WHERE deleted_at IS NULL AND is_completed = 0 AND company_id = ? AND deal_id IN (${inList})
       ORDER BY
         CASE WHEN deadline IS NULL THEN 1 ELSE 0 END,
         deadline ASC,
         CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
         created_at ASC`,
      [companyId, ...dealIds],
    ),
    selectMany<{ deal_id: number; count: number }>(
      db,
      `SELECT deal_id, COUNT(*) as count FROM deal_activities
       WHERE company_id = ? AND deleted_at IS NULL AND is_completed = 0 AND deal_id IN (${inList})
       GROUP BY deal_id`,
      [companyId, ...dealIds],
    ),
    selectMany<{
      deal_id: number
      deadline: string | null
    }>(
      db,
      `SELECT deal_id, deadline FROM deal_activities
       WHERE company_id = ? AND deleted_at IS NULL AND is_completed = 0 AND deal_id IN (${inList})`,
      [companyId, ...dealIds],
    ),
    selectMany<{ deal_id: number; count: number }>(
      db,
      `SELECT deal_id, COUNT(*) as count FROM deal_notes
       WHERE company_id = ? AND deleted_at IS NULL AND deal_id IN (${inList})
       GROUP BY deal_id`,
      [companyId, ...dealIds],
    ),
  ])

  const imagesMap: Record<number, boolean> = {}
  for (const row of imagesCounts) imagesMap[row.deal_id] = Number(row.count) > 0

  const emailsMap: Record<number, boolean> = {}
  for (const row of emailCounts) emailsMap[row.deal_id] = Number(row.count) > 0

  const nearestActivityMap: DealsBoardMaps['nearestActivityMap'] = {}
  for (const a of nearestActivities) {
    if (!nearestActivityMap[a.deal_id]) {
      nearestActivityMap[a.deal_id] = {
        id: a.id,
        name: a.name,
        deadline: a.deadline,
        priority: a.priority,
      }
    }
  }

  const activitiesMap: Record<number, boolean> = {}
  for (const row of activitiesCounts) activitiesMap[row.deal_id] = Number(row.count) > 1

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const activitiesIconMap: Record<number, 'red' | 'yellow' | 'gray'> = {}
  for (const row of activitiesDeadlines) {
    const current = activitiesIconMap[row.deal_id]
    if (current === 'red') continue
    const d = row.deadline ? new Date(row.deadline) : null
    if (!d || Number.isNaN(d.getTime())) {
      if (current === undefined) activitiesIconMap[row.deal_id] = 'gray'
      continue
    }
    const deadlineDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (deadlineDate.getTime() < today.getTime()) {
      activitiesIconMap[row.deal_id] = 'red'
    } else if (deadlineDate.getTime() === today.getTime()) {
      activitiesIconMap[row.deal_id] = 'yellow'
    } else if (current === undefined) {
      activitiesIconMap[row.deal_id] = 'gray'
    }
  }

  const notesMap: Record<number, boolean> = {}
  for (const row of notesCounts) notesMap[row.deal_id] = Number(row.count) >= 1

  return {
    imagesMap,
    emailsMap,
    nearestActivityMap,
    activitiesMap,
    activitiesIconMap,
    notesMap,
  }
}
