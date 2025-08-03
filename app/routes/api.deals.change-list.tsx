import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const form = await request.formData()
  const id = Number(form.get('id'))
  const toList = Number(form.get('toList'))
  if (!id || !toList) return data({ error: 'bad payload' }, { status: 400 })

  // find next position in target list
  const [row] = await db.query(
    'SELECT COALESCE(MAX(position),0)+1 AS next FROM deals WHERE list_id = ? AND deleted_at IS NULL',
    [toList],
  )
  await db.execute('UPDATE deals SET list_id = ?, position = ? WHERE id = ?', [
    toList,
    row.next,
    id,
  ])

  return data({ ok: true })
}
