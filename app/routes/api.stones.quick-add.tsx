import type { ResultSetHeader } from 'mysql2'
import { type ActionFunctionArgs, data, redirect } from 'react-router'
import { db } from '~/db.server'
import { quickAddStoneSchema } from '~/schemas/stones'
import { getEmployeeUser } from '~/utils/session.server'
import { generateLeftoverBundle } from '~/utils/slabHelpers.server'

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 })
  }

  const body = await request.json()
  const validation = quickAddStoneSchema.safeParse(body)

  if (!validation.success) {
    return data(
      { error: 'Validation failed', details: validation.error.format() },
      { status: 400 },
    )
  }

  const validatedData = validation.data

  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const [stoneResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO stones
       (name, type, retail_price, width, length, company_id, is_display)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        validatedData.name,
        validatedData.type || 'granite',
        validatedData.retail_price,
        validatedData.width,
        validatedData.length,
        validatedData.company_id,
        true,
      ],
    )

    const stoneId = stoneResult.insertId

    const slabs: { id: number }[] = []

    if (validatedData.leftover) {
      const bundle = generateLeftoverBundle()
      const [slabResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO slab_inventory
         (bundle, stone_id, width, length, is_leftover, url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bundle, stoneId, validatedData.width, validatedData.length, true, null],
      )
      slabs.push({ id: slabResult.insertId })
    } else {
      for (const bundle of validatedData.bundles) {
        const [slabResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO slab_inventory
           (bundle, stone_id, width, length, is_leftover, url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [bundle.trim(), stoneId, validatedData.width, validatedData.length, false, null],
        )
        slabs.push({ id: slabResult.insertId })
      }
    }

    await connection.commit()

    return data({
      success: true,
      stone: {
        id: stoneId,
        name: validatedData.name,
        type: validatedData.type || 'granite',
        retail_price: validatedData.retail_price,
      },
      slabs,
    })
  } catch (error) {
    // Rollback transaction on any error
    await connection.rollback()
    console.error('Failed to create stone:', error)
    return data(
      {
        error: 'Failed to create stone',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  } finally {
    // Always release connection back to pool
    connection.release()
  }
}
