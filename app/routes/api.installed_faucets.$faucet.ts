import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { getSession } from '~/sessions'
import { selectMany } from '~/utils/queryHelpers'
import { getUserBySessionId } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))
  const activeSession = session.data.sessionId || null
  if (!params.faucet) {
    return new Response('Bad url', { status: 400 })
  }
  const faucetId = parseInt(params.faucet)

  if (!activeSession) {
    return new Response('Unauthorized', { status: 401 })
  }
  const user = (await getUserBySessionId(activeSession)) || null
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  const images = await selectMany<{ id: number; url: string }>(
    db,
    'SELECT id, url FROM installed_faucets WHERE faucet_id = ?',
    [faucetId],
  )
  return Response.json({ images })
}
