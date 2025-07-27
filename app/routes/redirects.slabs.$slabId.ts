import { type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.slabId) {
    return new Response('Bad url', { status: 400 })
  }
  const slabId = parseInt(params.slabId)

  if (Number.isNaN(slabId)) {
    return new Response('Invalid slab ID', { status: 400 })
  }

  try {
    const slabData = await selectMany<{ stone_id: number }>(
      db,
      'SELECT stone_id FROM slab_inventory WHERE id = ?',
      [slabId],
    )

    if (!slabData || slabData.length === 0) {
      return new Response('Slab not found', { status: 404 })
    }

    return redirect(`/employee/stones/slabs/${slabData[0].stone_id}?slab=${slabId}`)
  } catch {
    return new Response('Server error', { status: 500 })
  }
}
