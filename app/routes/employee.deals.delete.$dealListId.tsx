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
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'

export async function action({ params, request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  const dealListId = params.dealListId
  await db.execute(`UPDATE deals_list SET deleted_at = NOW() WHERE id = ?`, [
    dealListId,
  ])

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Deal list deleted'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.dealListId) {
    return forceRedirectError(request.headers, 'No deal list id provided')
  }
  const dealListId = parseInt(params.dealListId)

  const deal = await selectId<{ name: string }>(
    db,
    'select name from deals_list WHERE id = ? AND deleted_at IS NULL',
    dealListId,
  )
  return {
    name: deal?.name,
  }
}

export default function DeleteDeal() {
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
      title='Delete deal'
      description={`Are you sure you want to delete ${name}?`}
    />
  )
}
