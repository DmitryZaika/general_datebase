import type { RowDataPacket } from 'mysql2'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from 'react-router'
import { db } from '~/db.server'
import { todoListSchema } from '~/schemas/general'
import type { Todo } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request)

  const raw = await request.json()
  const data = todoListSchema.parse(raw)

  // Insert new todos at the TOP by assigning position = min-1
  const [rows] = await db.query<(RowDataPacket & { minPos: number })[]>(
    `SELECT COALESCE(MIN(position), 0) AS minPos FROM todolist WHERE user_id = ?`,
    [user.id],
  )
  const minPos = Array.isArray(rows) && rows.length > 0 ? rows[0].minPos : 0
  const newPos = (Number.isFinite(minPos) ? minPos : 0) - 1

  await db.execute(
    `INSERT INTO todolist (rich_text, user_id, position) VALUES (?, ?, ?);`,
    [data.rich_text, user.id, newPos],
  )
  return Response.json({ success: true })
}

export async function loader({ request }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const todos = await selectMany<Todo>(
    db,
    'SELECT id, rich_text, is_done, position, created_date FROM todolist WHERE user_id = ? ORDER BY position ASC',
    [user.id],
  )
  return Response.json({ todos })
}
