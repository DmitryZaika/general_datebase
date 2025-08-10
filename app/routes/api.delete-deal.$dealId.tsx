import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== 'POST')
    return data({ error: 'Method not allowed' }, { status: 405 })

  //   try {
  //     await csrf.validate(request)
  //   } catch {
  //     return data({ error: 'Bad CSRF' }, { status: 403 })
  //   }
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const dealId = Number(params.dealId)
  if (!dealId) return data({ error: 'Bad id' }, { status: 400 })

  await db.execute(
    'UPDATE deals SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [dealId],
  )

  return data({ ok: true })
}
