import type { ActionFunctionArgs } from 'react-router'
import { db } from '~/db.server'
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
    updates?: { id: number; list_id: number; position: number }[]
  }

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return new Response('No updates provided', { status: 400 })
  }

  try {
    for (const { id, list_id, position } of updates) {
      if (!id || list_id === undefined || position === undefined) continue
      await db.execute('UPDATE deals SET list_id = ?, position = ? WHERE id = ?', [
        list_id,
        position,
        id,
      ])
    }
    return Response.json({ success: true })
  } catch {
    return new Response('Error updating deals', { status: 500 })
  }
}
