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

  await db.execute(`INSERT INTO todolist (rich_text, user_id) VALUES (?, ?);`, [
    data.rich_text,
    user.id,
  ])
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
