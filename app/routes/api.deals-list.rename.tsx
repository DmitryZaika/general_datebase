import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 })
  }

  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const { id, name } = await request.json()
  if (!id || typeof name !== 'string' || name.trim() === '') {
    return data({ error: 'Invalid payload' }, { status: 400 })
  }

  await db.execute('UPDATE deals_list SET name = ? WHERE id = ? AND user_id = ?', [
    name.trim(),
    id,
    user.id,
  ])

  return data({ ok: true })
}
