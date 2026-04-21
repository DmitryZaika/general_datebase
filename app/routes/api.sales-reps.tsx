import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, getEmployeeUser } from '~/utils/session.server'

interface User {
  id: number
  name: string
}

export async function loader({ request }: LoaderFunctionArgs) {
  let companyId: number
  try {
    const admin = await getAdminUser(request)
    if (admin?.company_id !== undefined) {
      companyId = admin.company_id
    } else {
      const employee = await getEmployeeUser(request)
      companyId = employee.company_id
    }
  } catch {
    const employee = await getEmployeeUser(request)
    companyId = employee.company_id
  }

  const users = await selectMany<User>(
    db,
    `SELECT u.id, u.name
     FROM users u
     JOIN users_positions up ON up.user_id = u.id
     JOIN positions p ON p.id = up.position_id
     WHERE LOWER(p.name) = 'sales_rep'
       AND u.is_deleted = 0
       AND u.company_id = ?`,
    [companyId],
  )

  return data({ users })
}
