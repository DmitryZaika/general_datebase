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
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  const sinkId = params.sink
  await db.execute(`UPDATE sink_type SET is_deleted = 1 WHERE id = ?`, [sinkId])
  await db.execute(`UPDATE sinks SET is_deleted = 1 WHERE sink_type_id = ?`, [sinkId])
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Sink Deleted'))
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
  if (!params.sink) {
    return forceRedirectError(request.headers, 'No Sink id provided')
  }
  const sinkId = parseInt(params.sink)

  const sink = await selectId<{ name: string }>(
    db,
    'select name from sink_type WHERE id = ?',
    sinkId,
  )
  return {
    name: sink?.name,
  }
}

export default function SinksDelete() {
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
