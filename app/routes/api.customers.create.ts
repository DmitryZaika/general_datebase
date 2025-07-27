import type { ResultSetHeader } from 'mysql2'
import { ActionFunctionArgs, data } from 'react-router'
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
    `INSERT INTO customers (name, phone, email, address, referral_source, from_check_in, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      validatedData.name,
      validatedData.phone || null,
      validatedData.email || null,
      validatedData.address,
      validatedData.referral_source || null,
      true,
      validatedData.company_id,
    ],
  )

  const customerId = result.insertId

  return data({
    success: true,
    message: 'Customer created successfully',
    customerId,
  })
}
