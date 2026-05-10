import type { LoaderFunctionArgs } from 'react-router'
import { getSession } from '~/sessions.server'
import { getUserBySessionId } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))
  const activeSession = session.data.sessionId || null
  if (!params.imageId) {
    return new Response('Bad url', { status: 400 })
  }
  const imageId = Number.parseInt(params.imageId, 10)
  if (!Number.isFinite(imageId)) {
    return new Response('Bad url', { status: 400 })
  }
  if (!activeSession) {
    return new Response('Unauthorized', { status: 401 })
  }
  const user = (await getUserBySessionId(activeSession)) || null
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  return Response.json({ images: [] })
}
