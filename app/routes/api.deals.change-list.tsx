import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const form = await request.formData()
  const id = Number(form.get('id'))
  const toList = Number(form.get('toList'))
  if (!id || !toList) return data({ error: 'bad payload' }, { status: 400 })

  const prevRows = await selectMany<{ list_id: number }>(
    db,
    'SELECT list_id FROM deals WHERE id = ? LIMIT 1',
    [id],
  )
  const prevListId = prevRows[0]?.list_id

  await db.execute(
    'UPDATE deals SET list_id = ?, due_date = IF(? IN (4,5), NULL, due_date), updated_at = NOW() WHERE id = ?',
    [toList, toList, id],
  )

  if (prevListId !== undefined && prevListId !== toList) {
    await db.execute(
      'UPDATE deal_stage_history SET exited_at = NOW() WHERE deal_id = ? AND exited_at IS NULL',
      [id],
    )
    await db.execute(
      'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
      [id, toList],
    )
  }

  return data({ ok: true })
}
