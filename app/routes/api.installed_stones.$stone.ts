import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

export async function loader({ request, params }: LoaderFunctionArgs) {
  // const session = await getSession(request.headers.get("Cookie"));
  // const activeSession = session.data.sessionId || null;
  if (!params.stone) {
    return new Response('Bad url', { status: 400 })
  }
  const stoneId = parseInt(params.stone)

  // if (!activeSession) {
  //   return new Response("Unauthorized", { status: 401 });
  // }
  // let user = (await getUserBySessionId(activeSession)) || null;
  // if (!user) {
  //   return new Response("Unauthorized", { status: 401 });
  // }

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
  ).catch(err => {
    console.error('Error fetching linked images:', err)
    return []
  })

  const allImages = [...directImages, ...linkedImages]

  return Response.json({ images: allImages })
}
