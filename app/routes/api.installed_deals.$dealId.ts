import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.dealId) {
    return new Response('Bad url', { status: 400 })
  }
  const dealId = parseInt(params.dealId)

  const images = await selectMany<{ id: number; url: string }>(
    db,
    'SELECT id, image_url as url FROM deals_images WHERE deal_id = ? ORDER BY created_at DESC',
    [dealId],
  )

  return Response.json({ images })
}
