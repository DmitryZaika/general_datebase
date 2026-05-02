import { type ActionFunctionArgs, data } from 'react-router'
import { reactivateDeal } from '~/crud/deals'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const json = await request.json()
  const { id, is_won } = json

  if (!id || is_won === undefined)
    return data({ error: 'bad payload' }, { status: 400 })

  if (is_won === 1) {
    await db.execute(
      'UPDATE deals SET is_won = 1, lost_reason = NULL, due_date = NULL WHERE id = ?',
      [id],
    )
  } else if (is_won === 0) {
    await db.execute(
      'UPDATE deals SET is_won = 0, lost_reason = NULL, due_date = NULL WHERE id = ?',
      [id],
    )
  } else if (is_won === null) {
    await db.execute(
      'UPDATE deals SET is_won = NULL, lost_reason = NULL WHERE id = ?',
      [id],
    )
    await reactivateDeal(id)
  }

  return data({ ok: true })
}
