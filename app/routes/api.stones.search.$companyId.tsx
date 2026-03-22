import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import type { StoneSearchResult } from '~/types'
import { selectMany } from '~/utils/queryHelpers'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const [, searchParams] = request.url.split('?')
  const cleanParams = new URLSearchParams(searchParams)
  const searchTerm = cleanParams.get('name')
  const showSoldOutValue = cleanParams.get('show_sold_out')
  const showSoldOut = showSoldOutValue === 'true' || showSoldOutValue === '1'

  const companyId = Number(params.companyId)

  if (Number.isNaN(companyId) || companyId <= 0) {
    return Response.json({ stones: [] })
  }

  if (!searchTerm) {
    return Response.json({ stones: [] })
  }

  let query = `SELECT s.id, s.type, s.width, s.length, s.name, s.url, s.retail_price, s.cost_per_sqft, s.is_display, s.samples_amount, s.regular_stock, s.bundle_number,
            CAST(SUM(CASE WHEN si.id IS NOT NULL AND si.sale_id IS NULL AND si.cut_date IS NULL AND si.deleted_at IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) AS available,
            CAST(SUM(CASE WHEN si.id IS NOT NULL AND si.deleted_at IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) AS amount
    FROM stones s
    LEFT JOIN slab_inventory AS si ON (
      si.stone_id = s.id
      OR si.stone_id IN (
        SELECT source_stone_id
        FROM stone_slab_links
        WHERE stone_id = s.id
      )
    )
    WHERE UPPER(s.name) LIKE UPPER(?)
    AND s.company_id = ?
    AND s.deleted_at IS NULL
    AND (s.is_display = 1 OR ? = 1)
    GROUP BY s.id, s.type, s.name, s.url, s.width, s.length, s.retail_price, s.cost_per_sqft, s.is_display, s.samples_amount, s.regular_stock, s.bundle_number`

  // Only filter by availability if explicitly requested (showSoldOut=false)
  // When unsold_only=true (from StoneSearch), show all stones including those without slabs
  if (!showSoldOut && !cleanParams.get('unsold_only')) {
    query += `\nHAVING (available > 0 OR regular_stock = 1)`
  }

  query += `\nORDER BY 
      CASE 
        WHEN UPPER(s.name) LIKE UPPER(?) THEN 0  
        WHEN UPPER(s.name) LIKE UPPER(?) THEN 1  
        ELSE 2                                  
      END,
      s.name ASC
    LIMIT 5`

  const stones = await selectMany<StoneSearchResult>(db, query, [
    `%${searchTerm}%`,
    companyId,
    showSoldOut ? 1 : 0,
    `${searchTerm}%`,
    `% ${searchTerm} %`,
  ])

  return data({ stones })
}
