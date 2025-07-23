import { createCookieSessionStorage, type Session } from 'react-router'
import type { ToastMessage } from './utils/toastHelpers'

type SessionData = {
  sessionId: string
  qboRealmId: string
  qboAccessToken: string
  qboRefreshToken: string
  qboAccessExpires: number
  qboRefreshExpires: number
}

type SessionFlashData = {
  message: ToastMessage
}

export type RemixSession = Session<SessionData, SessionFlashData>

const { getSession, commitSession, destroySession } = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  cookie: {
    name: '__session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7 * 50,
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET || ''],
    secure: false,
  },
})
export { getSession, commitSession, destroySession }
