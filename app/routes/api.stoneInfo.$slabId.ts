import { data, type LoaderFunctionArgs } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import type { StoneSlim } from '~/types'
import { selectMany } from '~/utils/queryHelpers'

const paramsParse = z.object({
  slabId: z.coerce.number().int().positive(),
})

export async function loader({ params }: LoaderFunctionArgs) {
  
  const result = paramsParse.safeParse(params)
  if (!result.success) {
    return new Response(result.error.message, { status: 422 })
  }

  const stoneInfo = await selectMany<StoneSlim>(
    db,
    `SELECT stones.id, stones.type, stones.name
     FROM stones 
     JOIN slab_inventory ON slab_inventory.stone_id = stones.id 
     WHERE slab_inventory.id = ?`,
    [result.data.slabId],
  )

  if (stoneInfo.length === 0) {
    throw new Error('Stone not found')
  }
  const {id, type, name} = stoneInfo[0]
  return data({ id, type, name })
}
