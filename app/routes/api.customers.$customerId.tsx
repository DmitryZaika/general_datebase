import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { type ActionFunctionArgs, data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { customerSignupSchema } from '~/schemas/customers'
import { getEmployeeUser } from '~/utils/session.server'

interface Customer {
  id: number
  name: string
  address: string | null
  phone: string | null
  email: string | null
  company_name: string | null
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const customerId = params.customerId

  if (!customerId) {
    return data({ error: 'Customer ID is required' }, { status: 400 })
  }

  try {
    // Get customer details
    const [customer] = await db.query<(Customer & RowDataPacket)[]>(
      `SELECT id, name, address, phone, email, company_name 
       FROM customers 
       WHERE id = ? AND company_id = ?`,
      [customerId, user.company_id],
    )

    if (!customer || customer.length === 0) {
      return data({ error: 'Customer not found' }, { status: 404 })
    }

    return data({ customer: customer[0] })
  } catch {
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
    `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, referral_source = ?, source = ?, company_id = ?, company_name = ? WHERE id = ?`,
    [
      validatedData.name,
      validatedData.phone || null,
      validatedData.email || null,
      validatedData.address || null,
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
