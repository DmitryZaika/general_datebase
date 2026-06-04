// app/routes/todoList.ts

import type { RowDataPacket } from 'mysql2'
import type { ActionFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { todoListSchema } from '~/schemas/general'
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError } from '~/utils/toastHelpers.server'

const editAction = async (
  rich_text: string,
  todoId: number,
  userId: number,
): Promise<void> => {
  await db.execute(
    `UPDATE todolist
     SET rich_text = ?
     WHERE id = ?
     AND user_id = ?;`,
    [rich_text, todoId, userId],
  )
}

const updateDoneAction = async (
  todoId: number,
  isDone: boolean,
  userId: number,
): Promise<void> => {
  if (isDone) {
    // Move completed todo to the bottom by setting position to max+1 for the user
    const [rows] = await db.query<(RowDataPacket & { maxPos: number })[]>(
      `SELECT COALESCE(MAX(position), -1) AS maxPos FROM todolist WHERE user_id = ?`,
      [userId],
    )
    const maxPos = Array.isArray(rows) && rows.length > 0 ? rows[0].maxPos : -1
    const newPos = (Number.isFinite(maxPos) ? maxPos : -1) + 1

    await db.execute(
      `UPDATE todolist
       SET is_done = ?, position = ?
       WHERE id = ?
       AND user_id = ?;`,
      [isDone, newPos, todoId, userId],
    )
  } else {
    const [completedRows] = await db.query<
      (RowDataPacket & { minCompletedPos: number | null })[]
    >(
      `SELECT MIN(position) AS minCompletedPos
       FROM todolist
       WHERE user_id = ?
         AND is_done = 1
         AND id != ?`,
      [userId, todoId],
    )
    const minCompletedPos =
      Array.isArray(completedRows) && completedRows.length > 0
        ? completedRows[0].minCompletedPos
        : null

    let newPos: number
    if (minCompletedPos !== null && Number.isFinite(Number(minCompletedPos))) {
      newPos = Number(minCompletedPos) - 1
    } else {
      const [activeRows] = await db.query<(RowDataPacket & { maxActivePos: number })[]>(
        `SELECT COALESCE(MAX(position), -1) AS maxActivePos
         FROM todolist
         WHERE user_id = ?
           AND is_done = 0
           AND id != ?`,
        [userId, todoId],
      )
      const maxActivePos =
        Array.isArray(activeRows) && activeRows.length > 0
          ? activeRows[0].maxActivePos
          : -1
      newPos = (Number.isFinite(maxActivePos) ? maxActivePos : -1) + 1
    }

    await db.execute(
      `UPDATE todolist
       SET is_done = ?, position = ?
       WHERE id = ?
       AND user_id = ?;`,
      [isDone, newPos, todoId, userId],
    )
  }
}

const deleteAction = async (todoId: number, userId: number): Promise<void> => {
  await db.execute(
    `DELETE FROM todolist
     WHERE id = ?
     AND user_id = ?;`,
    [todoId, userId],
  )
}

export async function action({ params, request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request)

  if (!params.todo) {
    return forceRedirectError(request.headers, 'No user id provided')
  }

  const todoId = parseInt(params.todo, 10)
  if (!todoId) {
    return Response.json({ name: undefined })
  }

  if (request.method === 'POST') {
    const raw = await request.json()
    const data = todoListSchema.parse(raw)

    await editAction(data.rich_text, todoId, user.id)
    return Response.json({ success: true })
  }

  if (request.method === 'DELETE') {
    await deleteAction(todoId, user.id)
    return Response.json({ success: true })
  }
  if (request.method === 'PATCH') {
    const formData = await request.formData()
    const isDone = formData.get('isDone') === 'true'
    await updateDoneAction(todoId, isDone, user.id)
    return Response.json({ success: true })
  }
  return Response.json({ success: false })
}
