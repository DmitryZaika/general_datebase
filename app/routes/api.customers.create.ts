import type { ResultSetHeader } from 'mysql2'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { customerSignupSchema } from '~/schemas/customers'
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    )
  }

  try {
    const data = await request.json()
    const validatedData = customerSignupSchema.parse(data)

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

    return Response.json({
      success: true,
      message: 'Customer created successfully',
      customerId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          success: false,
          error: 'Validation error',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    console.error('Error creating customer:', error)
    return Response.json(
      {
        success: false,
        error: 'Failed to create customer',
      },
      { status: 500 },
    )
  }
}
