import type { ActionFunctionArgs } from 'react-router'
import { transitionDealStage } from '~/crud/deals'
import { db } from '~/db.server'
import {
  CLOSED_LOST_LIST_ID,
  CLOSED_WON_LIST_ID,
  TERMINAL_LIST_IDS,
} from '~/utils/constants'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  await getEmployeeUser(request)

  let payload: unknown
  try {
    payload = await request.json()
  } catch (error) {
    posthogClient.captureException(error)
    return new Response('Bad JSON payload', { status: 400 })
  }

  const { updates } = payload as {
    updates?: { id: number; list_id: number; position: number; status?: string }[]
  }

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return new Response('No updates provided', { status: 400 })
  }

  try {
    // prefetch list names for mapping id -> name
    const listsRows = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL',
      [],
    )
    const listNameById = new Map<number, string>(
      listsRows.map(l => [l.id, l.name] as [number, string]),
    )

    // prefetch current list_id for all updated deals to detect cross-list moves
    const ids = updates.map(u => u.id)
    const currentRows = await selectMany<{
      id: number
      list_id: number
    }>(
      db,
      `SELECT id, list_id FROM deals WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids,
    )
    const currentListById = new Map<number, number>(
      currentRows.map(r => [r.id, r.list_id] as [number, number]),
    )

    for (const { id, list_id, position } of updates) {
      if (!id || list_id === undefined || position === undefined) continue
      const statusToSet = listNameById.get(list_id) || ''
      const prevListId = currentListById.get(id)
      const movedAcrossLists =
        prevListId !== undefined && prevListId !== list_id ? 1 : 0

      const fromTerminal = prevListId !== undefined && TERMINAL_LIST_IDS.includes(prevListId)

      await db.execute(
        `UPDATE deals SET list_id = ?, status = ?, position = ?,
         due_date = CASE WHEN ? IN (?, ?) THEN NULL ELSE due_date END,
         lost_reason = IF(? != ?, NULL, lost_reason),
         is_won = CASE WHEN ? = 1 AND ? = ? THEN 1 WHEN ? = 1 AND ? = ? THEN 0 WHEN ? = 1 AND ? = 1 THEN NULL ELSE is_won END,
         updated_at = CASE WHEN ? = 1 THEN NOW() ELSE updated_at END
         WHERE id = ?`,
        [
          list_id, statusToSet, position,
          list_id, CLOSED_WON_LIST_ID, CLOSED_LOST_LIST_ID,
          list_id, CLOSED_LOST_LIST_ID,
          movedAcrossLists, list_id, CLOSED_WON_LIST_ID,
          movedAcrossLists, list_id, CLOSED_LOST_LIST_ID,
          movedAcrossLists, fromTerminal ? 1 : 0,
          movedAcrossLists,
          id,
        ],
      )

      if (movedAcrossLists) {
        await transitionDealStage(id, list_id)
      }
    }
    return Response.json({ success: true })
  } catch (error) {
    posthogClient.captureException(error)
    return new Response('Error updating deals', { status: 500 })
  }
}
