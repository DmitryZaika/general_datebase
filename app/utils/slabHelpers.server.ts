import type { ResultSetHeader } from 'mysql2'
import { db } from '~/db.server'

export function generateLeftoverBundle(): string {
  // Generate compact unique bundle for leftover slabs
  // Format: LO-{timestamp}-{random}
  // LO = Leftover identifier

  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')

  // Generate 4 random hex characters (0-9, A-F)
  const randomHex = crypto.randomUUID().substring(0, 4).toUpperCase()

  return `LO-${timestamp}-${randomHex}`
}

export async function createSlabForStone(params: {
  stoneId: number
  bundle: string
  width: number
  length: number
  isLeftover: boolean
  url?: string
}): Promise<number> {
  const { stoneId, bundle, width, length, isLeftover, url } = params

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO slab_inventory
     (bundle, stone_id, width, length, is_leftover, url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [bundle, stoneId, width, length, isLeftover, url || null],
  )

  return result.insertId
}
