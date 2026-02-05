import type { ResultSetHeader } from 'mysql2'
import { type ActionFunctionArgs, data, redirect } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser } from '~/utils/session.server'

const quickEditSchema = z.object({
  retail_price: z.coerce.number().min(0, 'Price must be positive'),
  width: z.coerce.number().min(0, 'Width must be positive'),
  length: z.coerce.number().min(0, 'Length must be positive'),
})

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (request.method !== 'PATCH') {
    return data({ error: 'Method not allowed' }, { status: 405 })
  }

  const stoneId = parseInt(params.stoneId || '', 10)
  if (Number.isNaN(stoneId)) {
    return data({ error: 'Invalid stone ID' }, { status: 400 })
  }

  const body = await request.json()
  const validation = quickEditSchema.safeParse(body)

  if (!validation.success) {
    return data(
      { error: 'Validation failed', details: z.treeifyError(validation.error) },
      { status: 400 },
    )
  }

  const { retail_price, width, length } = validation.data

  try {
    // Update stone
    await db.execute<ResultSetHeader>(
      `UPDATE stones
       SET retail_price = ?, width = ?, length = ?
       WHERE id = ?`,
      [retail_price, width, length, stoneId],
    )

    // Update associated leftover slab dimensions (if exists)
    await db.execute<ResultSetHeader>(
      `UPDATE slab_inventory
       SET width = ?, length = ?
       WHERE stone_id = ? AND is_leftover = TRUE`,
      [width, length, stoneId],
    )

    return data({
      success: true,
      stone: {
        id: stoneId,
        retail_price,
        width,
        length,
      },
    })
  } catch (error) {
    posthogClient.captureException(error)
    return data(
      {
        error: 'Failed to update stone',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
