import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface StoneListItem {
  id: number
  name: string
  url: string | null
  type: string | null
  finishing: string | null
  level: number | null
  installed_count: number
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const companyId = Number(params.companyId)
    if (Number.isNaN(companyId) || companyId <= 0 || user.company_id !== companyId) {
      return Response.json({ stones: [] })
    }
    const url = new URL(request.url)
    const nameParam = url.searchParams.get('name')?.trim() ?? ''
    const searchTerm = nameParam ? `%${nameParam}%` : '%'
    const typeParam = url.searchParams.get('type')?.trim() ?? ''
    const types = typeParam
      ? typeParam
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
      : []
    const finishingParam = url.searchParams.get('finishing')?.trim() ?? ''
    const finishings = finishingParam
      ? finishingParam
          .split(',')
          .map(f => f.trim())
          .filter(Boolean)
      : []
    const levelParam = url.searchParams.get('level')?.trim() ?? ''
    const levels = levelParam
      ? levelParam
          .split(',')
          .map(l => parseInt(l.trim(), 10))
          .filter(n => !Number.isNaN(n))
      : []

    const typeClause = types.length
      ? `AND s.type IN (${types.map(() => '?').join(',')})`
      : ''
    const finishingClause = finishings.length
      ? `AND s.finishing IN (${finishings.map(() => '?').join(',')})`
      : ''
    const levelClause = levels.length
      ? `AND s.level IN (${levels.map(() => '?').join(',')})`
      : ''

    const query = `SELECT s.id, s.name, s.url, s.type, s.finishing, s.level,
    (SELECT COUNT(*) FROM installed_stones is2 WHERE is2.stone_id = s.id)
    + (SELECT COUNT(*) FROM stone_image_links sil JOIN installed_stones is2 ON is2.stone_id = sil.source_stone_id WHERE sil.stone_id = s.id) AS installed_count
    FROM stones s
    LEFT JOIN slab_inventory AS si ON (
      si.stone_id = s.id
      OR si.stone_id IN (
        SELECT source_stone_id
        FROM stone_slab_links
        WHERE stone_id = s.id
      )
    )
    WHERE s.company_id = ?
    AND s.deleted_at IS NULL
    AND s.is_display = 1
    AND (UPPER(s.name) LIKE UPPER(?) OR ? = 1)
    ${typeClause}
    ${finishingClause}
    ${levelClause}
    GROUP BY s.id, s.name, s.url, s.regular_stock, s.type, s.finishing, s.level
    HAVING (CAST(SUM(CASE WHEN si.id IS NOT NULL AND si.sale_id IS NULL AND si.cut_date IS NULL AND si.deleted_at IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) > 0
       OR s.regular_stock = 1)
    ORDER BY s.name ASC
    LIMIT 200`

    const placeholders = [
      companyId,
      searchTerm,
      nameParam ? 0 : 1,
      ...types,
      ...finishings,
      ...levels,
    ]
    const stones = await selectMany<StoneListItem>(db, query, placeholders)
    return Response.json({ stones })
  } catch {
    return Response.json({ stones: [] })
  }
}
