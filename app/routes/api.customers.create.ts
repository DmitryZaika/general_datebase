import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { customerSignupSchema } from '~/schemas/customers'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    )
  }

  const user = await getEmployeeUser(request)

  const userData = await request.json()
  const validatedData = customerSignupSchema.parse(userData)

  let salesRep: number | null = null
  if (validatedData.source !== 'check-in') {
    const [positionRows] = await db.execute<RowDataPacket[]>(
      `SELECT 1 FROM users_positions up
       JOIN positions p ON up.position_id = p.id
       WHERE up.user_id = ? AND p.name = 'sales_rep'
       LIMIT 1`,
      [user.id],
    )
    salesRep = positionRows.length > 0 ? user.id : null
  }

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO customers (name, phone, email, address, your_message, referral_source, source, company_id, company_name, sales_rep) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      validatedData.name,
      validatedData.phone || null,
      validatedData.email || null,
      validatedData.address || null,
      validatedData.your_message || null,
      validatedData.referral_source || null,
      validatedData.source,
      validatedData.company_id,
      validatedData.company_name || null,
      salesRep,
    ],
  )

  const customerId = result.insertId

  if (salesRep) {
    const listId = 1
    const [posRows] = await db.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(position),0)+1 AS next FROM deals WHERE list_id = ? AND deleted_at IS NULL',
      [listId],
    )
    const nextPos = posRows[0]?.next ?? 1
    await db.execute(
      'INSERT INTO deals (customer_id, status, list_id, position, user_id) VALUES (?,?,?,?,?)',
      [customerId, 'New Customer', listId, nextPos, salesRep],
    )
  }

  return data({
    success: true,
    message: 'Customer created successfully',
    customerId,
  })
}
