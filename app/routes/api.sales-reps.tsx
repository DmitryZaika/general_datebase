import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface User {
  id: number
  name: string
}

export async function loader({ request }: LoaderFunctionArgs) {
  const current = await getEmployeeUser(request)

  const users = await selectMany<User>(
    db,
    `SELECT u.id, u.name
     FROM users u
     JOIN users_positions up ON up.user_id = u.id
     JOIN positions p ON p.id = up.position_id
     WHERE LOWER(p.name) = 'sales_rep'
       AND u.is_deleted = 0
       AND u.company_id = ?`,
    [current.company_id],
  )

  return data({ users })
}
