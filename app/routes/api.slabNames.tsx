import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)

  const url = new URL(request.url)

  let idStrings: string[] = url.searchParams.getAll('ids')
  if (idStrings.length === 1 && idStrings[0]?.includes(',')) {
    idStrings = idStrings[0].split(',')
  }

  const ids = idStrings
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0)

  let sql = `SELECT slab_inventory.id, slab_inventory.bundle FROM slab_inventory
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
    name: string
  }>(db, sql, params)

  return data({ slabNames })
}
