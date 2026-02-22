import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const json = await request.json()
  const { id, is_won } = json

  if (!id || is_won === undefined)
    return data({ error: 'bad payload' }, { status: 400 })

  await db.execute('UPDATE deals SET is_won = ?, lost_reason = NULL WHERE id = ?', [
    is_won,
    id,
  ])
  return data({ ok: true })
}
