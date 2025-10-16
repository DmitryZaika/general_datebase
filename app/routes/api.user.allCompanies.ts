import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'

import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await getEmployeeUser(request)

  const user = await getEmployeeUser(request)

  const companies = await selectMany<{ id: number; name: string }>(
    db,
    `
      SELECT c.id, c.name
      FROM company c
      JOIN users_positions up ON up.company_id = c.id
      WHERE up.user_id = ? AND up.position_id = 7
    `,
    [user.id],
  )

  return data({
    companies,
  })
}
