import { X } from 'lucide-react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Form as RemixForm,
  redirect,
  useLoaderData,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { AdminMultiImageUploadForm } from '~/components/molecules/AdminMultiImageUploadForm'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'

export async function action({ request, params }: ActionFunctionArgs) {
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
  if (!params.sink) {
    return forceRedirectError(request.headers, 'No sink id provided')
  }
  const sinkId = parseInt(params.sink)

  if (request.method === 'DELETE') {
    const form = await request.formData()
    const id = form.get('id')
    if (!id) {
      return forceRedirectError(request.headers, 'No id provided')
    }
    const sid = parseInt(id.toString())
    const result = await selectId<{ url: string | null }>(
      db,
      'SELECT url FROM installed_sinks WHERE id = ?',
      sid,
    )
    await db.execute(`DELETE FROM installed_sinks WHERE id = ?`, [sid])
    const session = await getSession(request.headers.get('Cookie'))
    if (result?.url) {
      deleteFile(result.url)
    }
    session.flash('message', toastData('Success', 'Image Deleted'))
    return redirect(request.url, {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  const { errors, data } = await parseMutliForm(request, z.object({}), 'sinks')
  if (errors || !data) {
    return { errors }
  }

  const urls = typeof data.file === 'string' ? [data.file] : data.file

  for (const url of urls) {
    await db.execute(`INSERT INTO installed_sinks (url, sink_id) VALUES (?, ?)`, [
      url,
      sinkId,
    ])
  }

  const session = await getSession(request.headers.get('Cookie'))
  const msg = urls.length === 1 ? 'Image added' : `${urls.length} images added`
  session.flash('message', toastData('Success', msg))
  return redirect(request.url, {
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
    return forceRedirectError(request.headers, 'No sink id provided')
  }
  const sinkId = parseInt(params.sink)
  const sinks = await selectMany<{ id: number; url: string }>(
    db,
    'select id, url from installed_sinks WHERE sink_id = ?',
    [sinkId],
  )
  return { sinks }
}

export default function SelectImages() {
  const { sinks } = useLoaderData<typeof loader>()
  return (
    <>
      <AdminMultiImageUploadForm fileInputId='sink-image' />
      <div className='grid grid-cols-2  md:grid-cols-3 gap-4 mt-4'>
        {sinks.map(sink => (
          <div key={sink.id} className='relative group'>
            <img src={sink.url} alt='' className='w-full h-32 object-cover' />
            <div className='absolute top-2 right-2 flex justify-between items-start transition-opacity duration-300'>
              <RemixForm method='delete' title='Delete Sink' aria-label='Delete Image'>
                <input type='hidden' name='id' value={sink.id} />
                <AuthenticityTokenInput />
                <Button
                  type='submit'
                  className='size-4 p-4 text-white bg-gray-800 bg-opacity-60 rounded-full transition'
                >
                  <X />
                </Button>
              </RemixForm>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
