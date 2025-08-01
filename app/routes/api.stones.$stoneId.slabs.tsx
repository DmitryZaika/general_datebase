import { data, type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
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
    let query = `
      SELECT id, bundle
      FROM slab_inventory
      WHERE stone_id = ?
      AND sale_id IS NULL
    `

    const queryParams = [stoneId]

    if (excludeSlabIds.length > 0) {
      query += ' AND id NOT IN (?)'
      queryParams.push(excludeSlabIds)
    }

    const slabs = await selectMany<{ id: number; bundle: string }>(
      db,
      query,
      queryParams,
    )

    return data({ slabs })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch slabs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
