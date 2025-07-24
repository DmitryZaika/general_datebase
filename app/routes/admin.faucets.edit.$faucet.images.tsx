import { useEffect, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Form as RemixForm,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { FileInput } from '~/components/molecules/FileInput'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { Button } from '~/components/ui/button'
import { FormField } from '~/components/ui/form'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'
import { useCustomForm } from '~/utils/useCustomForm'

export const InstalledProjectsSchema = z.object({})
type TInstalledProjectsSchema = z.infer<typeof InstalledProjectsSchema>

export async function action({ request, params }: ActionFunctionArgs) {
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
  if (!params.faucet) {
    return forceRedirectError(request.headers, 'No faucet id provided')
  }
  const faucetId = parseInt(params.faucet)

  if (request.method === 'DELETE') {
    const form = await request.formData()
    const id = form.get('id')
    if (!id) {
      return forceRedirectError(request.headers, 'No id provided')
    }
    const sid = parseInt(id.toString())
    const result = await selectId<{ url: string | null }>(
      db,
      'SELECT url FROM installed_faucets WHERE id = ?',
      sid,
    )
    await db.execute(`DELETE FROM installed_faucets WHERE id = ?`, [sid])
    const session = await getSession(request.headers.get('Cookie'))
    if (result?.url) {
      deleteFile(result.url)
    }
    session.flash('message', toastData('Success', 'Image Deleted'))
    return redirect(request.url, {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  const { errors, data } = await parseMutliForm(
    request,
    InstalledProjectsSchema,
    'faucets',
  )
  if (errors || !data) {
    return { errors }
  }

  const faucet = await selectId<{ url: string }>(
    db,
    'select url from faucet_type WHERE id = ?',
    faucetId,
  )

  try {
    await db.execute(`INSERT INTO installed_faucets (url, faucet_id) VALUES (?, ?)`, [
      data.file,
      faucetId,
    ])
  } catch (error) {
    console.error('Error connecting to the database:', errors)
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Image Added'))
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
  if (!params.faucet) {
    return forceRedirectError(request.headers, 'No faucet id provided')
  }
  const faucetId = parseInt(params.faucet)
  const faucets = await selectMany<{ id: number; url: string }>(
    db,
    'select id, url from installed_faucets WHERE faucet_id = ?',
    [faucetId],
  )
  return { faucets }
}

function AddImage() {
  const navigation = useNavigation()
  const form = useCustomForm<TInstalledProjectsSchema>(InstalledProjectsSchema)

  const [inputKey, setInputKey] = useState(0)

  useEffect(() => {
    if (navigation.state === 'idle') {
      form.reset()
      setInputKey(k => k + 1)
    }
  }, [navigation.state, form])

  return (
    <MultiPartForm form={form}>
      <div className='flex items-center space-x-4'>
        <FormField
          control={form.control}
          name='file'
          render={({ field }) => (
            <FileInput
              key={inputKey}
              inputName='images'
              id='image'
              type='image'
              onChange={field.onChange}
            />
          )}
        />
        <Button type='submit' variant='blue'>
          Add image
        </Button>
      </div>
    </MultiPartForm>
  )
}

export default function SelectImages() {
  const { faucets } = useLoaderData<typeof loader>()
  return (
    <>
      <AddImage />
      <div className='grid grid-cols-2  md:grid-cols-3 gap-4 mt-4'>
        {faucets.map(faucet => (
          <div key={faucet.id} className='relative group'>
            <img src={faucet.url} alt='' className='w-full h-32 object-cover' />
            <div className='absolute top-2 right-2 flex justify-between items-start transition-opacity duration-300'>
              <RemixForm
                method='delete'
                title='Delete Faucet'
                aria-label='Delete Image'
              >
                <input type='hidden' name='id' value={faucet.id} />
                <AuthenticityTokenInput />
                <Button
                  type='submit'
                  className='size-4 p-4 text-white bg-gray-800 bg-opacity-60 rounded-full transition'
                >
                  <FaTimes />
                </Button>
              </RemixForm>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
