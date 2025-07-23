import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from 'react-router'
import { useLoaderData, useNavigate } from 'react-router'
import { selectId } from '~/utils/queryHelpers'
import { DeleteRow } from '~/components/pages/DeleteRow'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'
import { getAdminUser } from '~/utils/session.server'
import { csrf } from '~/utils/csrf.server'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

export async function action({ params, request }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  try {
    await csrf.validate(request)
  } catch (error) {
    return { error: 'Invalid CSRF token' }
  }

  if (!params.user) {
    return forceRedirectError(request.headers, 'No user id provided')
  }

  const userId = parseInt(params.user, 10)
  if (!userId) {
    return { name: undefined }
  }

  try {
    await db.execute(`UPDATE main.users SET is_deleted = 1 WHERE id = ?`, [userId])
  } catch (error) {
    console.error('Error soft-deleting user: ', error)
    return { error: 'Failed to soft-delete user' }
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'User deleted (soft)'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const userId = params.user ? parseInt(params.user, 10) : null
  if (!userId) {
    return { name: undefined }
  }

  const user = await selectId<{ name: string }>(
    db,
    'SELECT name FROM main.users WHERE id = ?',
    userId,
  )

  return {
    name: user?.name,
  }
}

export default function DeleteUser() {
  const navigate = useNavigate()
  const { name } = useLoaderData<typeof loader>()

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate('..')
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete user'
      description={`Are you sure you want to delete ${name}?`}
    />
  )
}
