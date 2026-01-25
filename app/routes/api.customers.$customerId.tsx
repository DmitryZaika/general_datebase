import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { type ActionFunctionArgs, data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { customerSignupSchema } from '~/schemas/customers'
import type { Customer } from '~/types/customer'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser, type User } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user: User = await getEmployeeUser(request)
  const customerId = params.customerId

  if (!customerId) {
    posthogClient.captureException(new Error('Customer ID is required'))
    return data({ error: 'Customer ID is required' }, { status: 400 })
  }

  try {
    // Get customer details
    const [customer] = await db.query<(Customer & RowDataPacket)[]>(
      `SELECT id, name, address, phone, phone_2, email, company_name, source, your_message
       FROM customers
       WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
      [customerId, user.company_id],
    )

    if (!customer || customer.length === 0) {
      posthogClient.captureException(new Error('Customer not found'))
      return data({ error: 'Customer not found' }, { status: 404 })
    }

    return data({ customer: customer[0] })
  } catch (error) {
    posthogClient.captureException(error)
    return data({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    )
  }

  const customerId = parseInt(params.customerId || '0')

  const userData = await request.json()
  const validatedData = customerSignupSchema.parse(userData)

  await db.execute<ResultSetHeader>(
    `UPDATE customers SET name = ?, phone = ?, phone_2 = ?, email = ?, address = ?, your_message = ?, referral_source = ?, source = ?, company_id = ?, company_name = ? WHERE id = ?`,
    [
      validatedData.name,
      validatedData.phone || null,
      validatedData.phone_2 || null,
      validatedData.email || null,
      validatedData.address || null,
      validatedData.your_message || null,
      validatedData.referral_source || null,
      validatedData.source,
      validatedData.company_id,
      validatedData.company_name || null,
      customerId,
    ],
  )

  return data({
    success: true,
    message: 'Customer updated successfully',
  })
}
