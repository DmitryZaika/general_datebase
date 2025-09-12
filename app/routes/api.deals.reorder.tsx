import type { ActionFunctionArgs } from 'react-router'
import { db } from '~/db.server'
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
  } catch {
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

    for (const { id, list_id, position } of updates) {
      if (!id || list_id === undefined || position === undefined) continue
      const statusToSet = listNameById.get(list_id) || ''
      await db.execute(
        'UPDATE deals SET list_id = ?, status = ?, position = ?, due_date = IF(? IN (4,5), NULL, due_date), lost_reason = IF(? != 5, NULL, lost_reason) WHERE id = ?',
        [list_id, statusToSet, position, list_id, list_id, id],
      )
    }
    return Response.json({ success: true })
  } catch {
    return new Response('Error updating deals', { status: 500 })
  }
}
