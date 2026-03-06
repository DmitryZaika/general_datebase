import { data, type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const lists = await selectMany<{ id: number; name: string; group_name: string }>(
      db,
      `SELECT dl.id, dl.name, gl.name AS group_name
       FROM deals_list dl
       JOIN groups_list gl ON dl.group_id = gl.id
       WHERE dl.deleted_at IS NULL
         AND gl.deleted_at IS NULL
         AND gl.is_displayed = 1
         AND (gl.company_id = ? OR gl.id = 1)
       ORDER BY gl.name, dl.position`,
      [user.company_id],
    )
    return data({ lists })
  } catch {
    return redirect('/login')
  }
}
