import type { ResultSetHeader } from 'mysql2'
import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { customerSignupSchema } from '~/schemas/customers'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    )
  }

  const userData = await request.json()
  const validatedData = customerSignupSchema.parse(userData)

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO customers (name, phone, email, address, referral_source, from_check_in, company_id, company_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      validatedData.name,
      validatedData.phone || null,
      validatedData.email || null,
      validatedData.address,
      validatedData.referral_source || null,
      true,
      validatedData.company_id,
      validatedData.company_name || null,
    ],
  )

  const customerId = result.insertId

  /* Temporarily disabled automatic deal creation
  // add deal in global "New Customers" list (id=1)
  const [[row]] = await db.query(
    'SELECT COALESCE(MAX(position),0)+1 AS next FROM deals WHERE list_id = 1 AND deleted_at IS NULL',
  )
  await db.execute(
    'INSERT INTO deals (customer_id,status,list_id,position) VALUES (?,?,1,?)',
    [customerId, 'new', row.next],
  )
  */

  return data({
    success: true,
    message: 'Customer created successfully',
    customerId,
  })
}
