import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const form = await request.formData()
  const id = Number(form.get('id'))
  const amountStr = form.get('amount') as string | null
  if (!id || amountStr === null) return data({ error: 'bad payload' }, { status: 400 })

  const amount = amountStr === '' ? null : parseFloat(amountStr)
  await db.execute('UPDATE deals SET amount = ? WHERE id = ?', [amount, id])
  return data({ ok: true })
}
