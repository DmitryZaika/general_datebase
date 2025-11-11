import type { LoaderFunctionArgs } from 'react-router'
import { redirect } from 'react-router'
import { db } from '~/db.server'
import { destroySession, getSession } from '~/sessions.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get('Cookie')
  const session = await getSession(cookie)
  const sessionId = session.get('sessionId')

  if (sessionId) {
    await db.execute(`UPDATE sessions SET is_deleted = 1 WHERE id = ?`, [sessionId])
  }

  return redirect('/login', {
    headers: {
      'Set-Cookie': await destroySession(session),
    },
  })
}

export default function Logout() {
  return null
}
