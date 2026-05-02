import type { ActionFunctionArgs } from 'react-router'
import { transitionDealStage } from '~/crud/deals'
import { db } from '~/db.server'
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
    const listsRows = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL',
      [],
    )
    const listNameById = new Map<number, string>(
      listsRows.map(l => [l.id, l.name] as [number, string]),
    )

    const ids = updates.map(u => u.id)
    const currentRows = await selectMany<{
      id: number
      list_id: number
      is_won: number | null
    }>(
      db,
      `SELECT id, list_id, is_won FROM deals WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids,
    )
    const currentListById = new Map<number, number>(
      currentRows.map(r => [r.id, r.list_id] as [number, number]),
    )
    const currentIsWonById = new Map<number, number | null>(
      currentRows.map(r => [r.id, r.is_won] as [number, number | null]),
    )

    for (const { id, list_id, position } of updates) {
      if (!id || list_id === undefined || position === undefined) continue
      const statusToSet = listNameById.get(list_id) || ''
      const prevListId = currentListById.get(id)
      const movedAcrossLists =
        prevListId !== undefined && prevListId !== list_id ? 1 : 0

      const prevIsWon = currentIsWonById.get(id)
      const fromClosed = prevIsWon === 1 || prevIsWon === 0

      await db.execute(
        `UPDATE deals SET list_id = ?, status = ?, position = ?,
         lost_reason = CASE WHEN ? = 1 AND ? = 1 THEN NULL ELSE lost_reason END,
         is_won = CASE WHEN ? = 1 AND ? = 1 THEN NULL ELSE is_won END,
         updated_at = CASE WHEN ? = 1 THEN NOW() ELSE updated_at END
         WHERE id = ?`,
        [
          list_id,
          statusToSet,
          position,
          movedAcrossLists,
          fromClosed ? 1 : 0,
          movedAcrossLists,
          fromClosed ? 1 : 0,
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
