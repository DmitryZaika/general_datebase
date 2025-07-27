import type { ActionFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request)

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const formData = await request.formData()
  const positionsData = formData.get('positions')

  if (!positionsData) {
    return new Response('No positions data provided', { status: 400 })
  }

  try {
    const positions = JSON.parse(positionsData.toString())

    for (const { id, position } of positions) {
      await db.execute(
        'UPDATE todolist SET position = ? WHERE id = ? AND user_id = ?',
        [position, id, user.id],
      )
    }

    return Response.json({ success: true })
  } catch {
    return new Response('Error updating positions', { status: 500 })
  }
}
