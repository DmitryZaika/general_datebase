import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch {
    return Response.json({ images: [] }, { status: 401 })
  }
  if (!params.stone) {
    return new Response('Bad url', { status: 400 })
  }
  const stoneId = parseInt(params.stone)
  if (Number.isNaN(stoneId)) {
    return Response.json({ images: [] })
  }

  const directImages = await selectMany<{ id: number; url: string }>(
    db,
    'SELECT id, url FROM installed_stones WHERE stone_id = ?',
    [stoneId],
  )

  const linkedImages = await selectMany<{ id: number; url: string }>(
    db,
    `SELECT is2.id, is2.url
     FROM stone_image_links sil
     JOIN installed_stones is2 ON is2.stone_id = sil.source_stone_id
     WHERE sil.stone_id = ?`,
    [stoneId],
  )

  const allImages = [...directImages, ...linkedImages]

  return Response.json({ images: allImages })
}
