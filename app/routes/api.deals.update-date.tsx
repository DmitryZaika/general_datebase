import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const form = await request.formData()
  const id = Number(form.get('id'))
  const dateStr = form.get('date') as string | null
  if (!id || dateStr === null) return data({ error: 'bad payload' }, { status: 400 })

  // Empty string means clear date
  const dateParam = dateStr === '' ? null : dateStr
  await db.execute(
    'UPDATE deals SET due_date = CASE WHEN list_id IN (4,5) THEN NULL ELSE ? END WHERE id = ?',
    [dateParam, id],
  )
  return data({ ok: true })
}
