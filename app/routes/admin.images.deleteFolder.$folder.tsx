import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'

export async function action({ params, request }: ActionFunctionArgs) {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  const folderId = params.folder ? parseInt(params.folder, 10) : null
  if (!folderId) {
    return { error: 'Invalid folder ID' }
  }

  const folderRows = await selectMany<{ id: number }>(
    db,
    `SELECT id FROM images_folders WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
    [folderId, user.company_id],
  )
  const folder = folderRows[0]
  if (!folder) {
    return forceRedirectError(request.headers, 'Folder not found')
  }

  await db.execute(
    `UPDATE images_folders SET deleted_at = NOW() WHERE id = ? AND company_id = ?`,
    [folderId, user.company_id],
  )
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Folder deleted'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.folder) {
    return forceRedirectError(request.headers, 'No folder id provided')
  }
  const folderId = parseInt(params.folder, 10)

  const folderRows = await selectMany<{ name: string }>(
    db,
    `SELECT name FROM images_folders WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
    [folderId, user.company_id],
  )
  const folder = folderRows[0]
  return {
    name: folder?.name ?? 'this folder',
  }
}

export default function ImagesDeleteFolder() {
  const navigate = useNavigate()
  const { name } = useLoaderData<{ name: string }>()

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete folder'
      description={`Are you sure you want to delete ${name}?`}
    />
  )
}
