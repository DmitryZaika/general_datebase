import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'

import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { selectId } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'

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
  const faucetId = params.faucet
  try {
    await db.execute(`UPDATE faucet_type SET is_deleted = 1 WHERE id = ?`, [faucetId])
    await db.execute(`UPDATE faucets SET is_deleted = 1 WHERE faucet_type_id = ?`, [
      faucetId,
    ])
  } catch (error) {
    console.error('Error connecting to the database: ', error)
  }
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Faucet Deleted'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch {
    return redirect(`/login?error=Unauthorized`)
  }
  if (!params.faucet) {
    return forceRedirectError(request.headers, 'No Faucet id provided')
  }
  const faucetId = parseInt(params.faucet)

  const faucet = await selectId<{ name: string }>(
    db,
    'select name from faucet_type WHERE id = ?',
    faucetId,
  )
  return {
    name: faucet?.name,
  }
}

export default function FaucetsDelete() {
  const { name } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title={name || ''}
      description={`Are you sure you want to delete ${name}?`}
    />
  )
}
