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
  const imageId = params.image ? parseInt(params.image, 10) : null
  if (!imageId) {
    return { error: 'Invalid image ID' }
  }
  try {
    const result = await db.execute(`DELETE FROM main.images WHERE id = ?`, [imageId])
  } catch (error) {
    console.error('Error connecting to the database: ', error)
  }
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'image Deleted'))
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
  if (!params.image) {
    return forceRedirectError(request.headers, 'No image id provided')
  }
  const imageId = parseInt(params.image)

  const image = await selectId<{ name: string }>(
    db,
    'select name from images WHERE id = ?',
    imageId,
  )
  return {
    name: image?.name || 'this image',
  }
}

export default function ImagesAdd() {
  const navigate = useNavigate()
  const { name } = useLoaderData<{ name: string | undefined }>()

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete image'
      description={`Are you sure you want to delete ${name}?`}
    />
  )
}
