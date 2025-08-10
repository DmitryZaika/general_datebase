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

  await db.execute(
    'UPDATE deals SET list_id = ?, due_date = IF(? IN (4,5), NULL, due_date) WHERE id = ?',
    [toList, toList, id],
  )

  return data({ ok: true })
}
