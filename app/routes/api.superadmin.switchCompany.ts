import { type ActionFunctionArgs, data, redirect } from 'react-router'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { Positions } from '~/types'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  const user = await getAdminUser(request)
  const formData = await request.formData()
  await csrf.validate(formData, request.headers)

  const rawCompanyId = formData.get('companyId')
  const companyId = Number(rawCompanyId)

  if (rawCompanyId === null || Number.isNaN(companyId) || companyId < 0) {
    return data(
      { error: `Invalid company ID: ${String(rawCompanyId)}` },
      { status: 400 },
    )
  }

  const rows = await selectMany<{ id: number }>(
    db,
    'SELECT up.user_id AS id FROM users_positions up WHERE up.user_id = ? AND up.position_id = ? AND up.company_id = ?',
    [user.id, Positions.SuperAdmin, companyId],
  )

  if (rows.length === 0) {
    return data({ error: 'Access denied to this company' }, { status: 403 })
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.set('activeCompanyId', companyId)

  const redirectTo =
    formData.get('redirect')?.toString() ||
    new URL(request.url).searchParams.get('redirect') ||
    '/'

  return redirect(redirectTo, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}
