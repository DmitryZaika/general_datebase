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
  const documentId = params.document
  await db.execute(`DELETE FROM documents WHERE id = ?`, [documentId])
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'document Deleted'))
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
  if (!params.document) {
    return forceRedirectError(request.headers, 'No document id provided')
  }
  const documentId = parseInt(params.document)

  const document = await selectId<{ name: string }>(
    db,
    'select name from documents WHERE id = ?',
    documentId,
  )
  return {
    name: document?.name,
  }
}

export default function DocumentsAdd() {
  const navigate = useNavigate()
  const { name } = useLoaderData<typeof loader>()

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete document'
      description={`Are you sure you want to delete ${name}?`}
    />
  )
}
