import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)

  // Parse the query parameters to see if specific slab IDs were requested
  const url = new URL(request.url)

  /*
    Supported formats:
      ?ids=1,2,3            (comma-separated list)
      ?ids=1&ids=2&ids=3    (repeated parameter)
  */
  let idStrings: string[] = url.searchParams.getAll('ids')
  if (idStrings.length === 1 && idStrings[0]?.includes(',')) {
    // Handle comma-separated list in a single param
    idStrings = idStrings[0].split(',')
  }

  const ids = idStrings
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0)

  let sql = `SELECT slab_inventory.id, slab_inventory.bundle, slab_inventory.is_leftover FROM slab_inventory
  JOIN stones ON slab_inventory.stone_id = stones.id
  WHERE stones.company_id = ?`
  const params: (number | string)[] = [user.company_id]

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',')
    sql += ` AND slab_inventory.id IN (${placeholders})`
    params.push(...ids)
  }

  const slabNames = await selectMany<{
    id: number
    bundle: string
    is_leftover: number
  }>(db, sql, params)

  const slabNamesWithLO = slabNames.map(slab => ({
    ...slab,
    is_leftover: Boolean(slab.is_leftover),
  }))

  return data({ slabNames: slabNamesWithLO })
}
