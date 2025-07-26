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

    if (sales_rep) {
      await db.query(
        `INSERT INTO notifications (user_id, customer_id, message, due_at)
				 SELECT ?, id, CONCAT('Please text to ', name), created_date + INTERVAL 24 HOUR
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
