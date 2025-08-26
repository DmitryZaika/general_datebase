import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'

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
    await db.query(`UPDATE customers SET sales_rep = ? WHERE id = ?`, [
      sales_rep,
      customer_id,
    ])

    // --- handle deals when assigning a sales rep ---
    if (sales_rep) {
      // глобальный список "New Customers" имеет id = 1
      const listId = 1

      // удалить активные сделки этого клиента у прошлого продавца
      await db.execute(
        'UPDATE deals SET deleted_at = NOW() WHERE customer_id = ? AND user_id <> ? AND deleted_at IS NULL',
        [customer_id, sales_rep],
      )

      // проверить, есть ли уже активная сделка у нового продавца
      const [existingRows] = await db.query(
        'SELECT id FROM deals WHERE customer_id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1',
        [customer_id, sales_rep],
      )
      const hasExisting = (existingRows as Array<{ id: number }>).length > 0

      if (!hasExisting) {
        // следующая позиция в списке
        const [posRows] = await db.query(
          'SELECT COALESCE(MAX(position),0)+1 AS next FROM deals WHERE list_id = ? AND deleted_at IS NULL',
          [listId],
        )
        const nextPos = (posRows as Array<{ next: number }>)[0]?.next ?? 1

        await db.execute(
          'INSERT INTO deals (customer_id, status, list_id, position, user_id) VALUES (?,?,?,?,?)',
          [customer_id, 'new', listId, nextPos, sales_rep],
        )
      }
    }

    if (sales_rep) {
      await db.query(
        `INSERT INTO notifications (user_id, customer_id, message, due_at)
				 SELECT ?, id, CONCAT('Please text ', name), created_date + INTERVAL 24 HOUR
				 FROM customers
				 WHERE id = ?
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
				 WHERE id = ?
				   AND NOT EXISTS (
				     SELECT 1 FROM notifications n
				     WHERE n.user_id = ? AND n.customer_id = ? AND n.is_done = 0 AND n.message LIKE 'Please check%'
				   )`,
        [sales_rep, customer_id, sales_rep, customer_id],
      )
    }

    return data({ success: true })
  } catch {
    return data({ error: 'Failed to update' }, { status: 500 })
  }
}
