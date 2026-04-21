import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data({ error: 'method' }, { status: 405 })
  }

  const user = await getEmployeeUser(request)
  const nextValue = user.pined_bar ? 0 : 1

  await db.execute('UPDATE users SET pined_bar = ? WHERE id = ?', [nextValue, user.id])

  return data({ pined_bar: nextValue })
}
