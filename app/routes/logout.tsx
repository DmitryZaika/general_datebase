import { useEffect } from 'react'
import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { destroySession, getSession } from '~/sessions'

// Handle the logout server-side
export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get('Cookie')
  if (!cookie) {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'No session to log out from',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const session = await getSession(cookie)
  const sessionId = session.get('sessionId')

  if (sessionId) {
    try {
      await db.execute(`UPDATE sessions SET is_deleted = 1 WHERE id = ?`, [sessionId])
    } catch (error) {
      console.error('Error marking session as deleted:', error)
    }
  }

  // Return success data and the cookie clearing header
  return new Response(
    JSON.stringify({ success: true, message: 'Logged out successfully' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': await destroySession(session),
      },
    },
  )
}

// Client component that immediately redirects to login
export default function Logout() {
  useEffect(() => {
    // Force a hard refresh to clear all state
    window.location.href = '/login'
  }, [])

  return (
    <div className='flex items-center justify-center h-screen'>
      <div className='text-center p-8 bg-white rounded-lg shadow-lg'>
        <h1 className='text-2xl font-bold mb-4'>Logging out...</h1>
        <p className='text-gray-600'>Please wait while you are redirected.</p>
      </div>
    </div>
  )
}
