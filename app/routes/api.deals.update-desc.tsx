import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const form = await request.formData()
  const id = Number(form.get('id'))
  const description = (form.get('description') as string | null) || null
  if (!id) return data({ error: 'bad payload' }, { status: 400 })

  await db.execute('UPDATE deals SET description = ? WHERE id = ?', [description, id])

  return data({ ok: true })
}
