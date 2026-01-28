import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!params.stoneId) {
    return new Response(JSON.stringify({ error: 'Stone ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stoneId = parseInt(params.stoneId, 10)
  if (Number.isNaN(stoneId)) {
    return new Response(JSON.stringify({ error: 'Invalid Stone ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const excludeSlabIds = JSON.parse(
    decodeURIComponent(url.searchParams.get('exclude') || '[]'),
  )

  try {
    // Include both direct slabs and linked slabs from other stones
    let query = `
      SELECT
        id,
        bundle,
        is_leftover,
        parent_id,
        (SELECT COUNT(*) FROM slab_inventory c WHERE c.parent_id = slab_inventory.id AND c.deleted_at IS NULL) as child_count
      FROM slab_inventory
      WHERE (
        stone_id = ?
        OR stone_id IN (
          SELECT source_stone_id FROM stone_slab_links WHERE stone_id = ?
        )
      )
      AND sale_id IS NULL
      AND cut_date IS NULL
      AND deleted_at IS NULL
    `

    const queryParams = [stoneId, stoneId]

    if (excludeSlabIds.length > 0) {
      query += ' AND id NOT IN (?)'
      queryParams.push(excludeSlabIds)
    }

    const slabs = await selectMany<{
      id: number
      bundle: string
      is_leftover: number
      parent_id: number | null
      child_count: number
    }>(db, query, queryParams)

    const slabsWithLO = slabs.map(slab => ({
      ...slab,
      is_leftover: Boolean(slab.is_leftover),
    }))

    return data({ slabs: slabsWithLO })
  } catch (error) {
    posthogClient.captureException(error)
    return new Response(JSON.stringify({ error: 'Failed to fetch slabs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
