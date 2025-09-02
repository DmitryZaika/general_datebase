import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.dealId) {
    return { images: [] }
  }

  const dealId = parseInt(params.dealId)

  const images = await selectMany<{ url: string }>(
    db,
    'SELECT image_url as url FROM deals_images WHERE deal_id = ? ORDER BY created_at DESC',
    [dealId],
  )

  return { images }
}
