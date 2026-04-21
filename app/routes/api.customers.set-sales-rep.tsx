import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { posthogClient } from '~/utils/posthog.server'

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json()
  const { customer_id, sales_rep } = body as {
    customer_id: number
    sales_rep: number | null
  }
  if (!customer_id) {
    return data({ error: 'customer_id required' }, { status: 400 })
  }
  try {
    await db.query(
      `UPDATE customers SET sales_rep = ?, assigned_date = NOW() WHERE id = ? AND deleted_at IS NULL`,
      [sales_rep, customer_id],
    )

    if (sales_rep) {
      const [companyRows] = await db.execute<RowDataPacket[]>(
        'SELECT company_id FROM customers WHERE id = ? LIMIT 1',
        [customer_id],
      )
      const companyId = companyRows[0]?.company_id

      const [defaultListRows] = await db.execute<RowDataPacket[]>(
        `SELECT dl.id, dl.name
         FROM groups_list g
         JOIN deals_list dl ON dl.group_id = g.id AND dl.deleted_at IS NULL
         WHERE g.deleted_at IS NULL AND g.is_default = 1
           AND (g.company_id = ? OR g.id = 1)
         ORDER BY dl.position ASC
         LIMIT 1`,
        [companyId],
      )
      const listId = defaultListRows[0]?.id ?? 1
      const status = defaultListRows[0]?.name ?? 'New Customer'

      await db.execute(
        'UPDATE deals SET user_id = ? WHERE customer_id = ? AND user_id <> ? AND deleted_at IS NULL',
        [sales_rep, customer_id, sales_rep],
      )

      const [existingRows] = await db.query(
        'SELECT id FROM deals WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
        [customer_id, sales_rep],
      )
      const hasExisting = (existingRows as Array<{ id: number }>).length > 0

      if (!hasExisting) {
        const [posRows] = await db.query(
          'SELECT COALESCE(MAX(position),0)+1 AS next FROM deals WHERE list_id = ? AND deleted_at IS NULL',
          [listId],
        )
        const nextPos = (posRows as Array<{ next: number }>)[0]?.next ?? 1

        const [dealResult] = await db.execute<ResultSetHeader>(
          'INSERT INTO deals (customer_id, status, list_id, position, user_id) VALUES (?,?,?,?,?)',
          [customer_id, status, listId, nextPos, sales_rep],
        )
        await db.execute(
          'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
          [dealResult.insertId, listId],
        )
      }
    }

    if (sales_rep) {
      await db.query(
        `INSERT INTO notifications (user_id, customer_id, message, due_at)
				 SELECT ?, id, CONCAT('Please text ', name), created_date + INTERVAL 24 HOUR
				 FROM customers
				 WHERE id = ? AND deleted_at IS NULL
				   AND NOT EXISTS (
				     SELECT 1
				     FROM notifications n
				     WHERE n.user_id = ? AND n.customer_id = ? AND n.is_done = 0
				   )`,
        [sales_rep, customer_id, sales_rep, customer_id],
      )
      await db.query(
        `INSERT INTO notifications (user_id, customer_id, message, due_at)
				 SELECT ?, id, CONCAT('Please check the customer ', name), created_date + INTERVAL 72 HOUR
				 FROM customers
				 WHERE id = ? AND deleted_at IS NULL
				   AND NOT EXISTS (
				     SELECT 1 FROM notifications n
				     WHERE n.user_id = ? AND n.customer_id = ? AND n.is_done = 0 AND n.message LIKE 'Please check%'
				   )`,
        [sales_rep, customer_id, sales_rep, customer_id],
      )
    }

    return data({ success: true })
  } catch (error) {
    posthogClient.captureException(error)
    return data({ error: 'Failed to update' }, { status: 500 })
  }
}
