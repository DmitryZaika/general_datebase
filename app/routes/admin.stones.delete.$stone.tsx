import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectId } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'

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
  if (!params.stone) {
    return forceRedirectError(request.headers, 'No document id provided')
  }
  const stoneId = parseInt(params.stone)
  const stone = await selectId<{ url: string }>(
    db,
    'select url from stones WHERE id = ?',
    stoneId,
  )
 
  // Get all slab images that need to be deleted from S3
  const slabsResult = await db.execute(
    `SELECT url FROM slab_inventory WHERE stone_id = ? AND url IS NOT NULL`,
    [stoneId],
  )

  // Delete slab images from S3
  const slabs = slabsResult[0] as Array<{ url: string }>
  if (slabs && slabs.length > 0) {
    for (const slab of slabs) {
      if (slab.url) {
        deleteFile(slab.url)
      }
    }
  }

  // Delete all slabs belonging to this stone
  await db.execute(`UPDATE slab_inventory SET deleted_at = CURRENT_TIMESTAMP WHERE stone_id = ?`, [stoneId])

  // Delete the stone itself
  await db.execute(`DELETE FROM stones WHERE id = ?`, [stoneId])

  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Stone Deleted'))
  return redirect(`..${searchString}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, 'No image id provided')
  }
  const stoneId = parseInt(params.stone)

  const stone = await selectId<{ name: string }>(
    db,
    'select name from stones WHERE id = ?',
    stoneId,
  )
  return {
    name: stone?.name,
  }
}

export default function StonesAdd() {
  const navigate = useNavigate()
  const location = useLocation()
  const { name } = useLoaderData<typeof loader>()

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`)
    }
  }
  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete stone'
      description={`Are you sure you want to delete ${name}?`}
    />
  )
}
