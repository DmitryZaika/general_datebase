import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router'
import { z } from 'zod'
import { FileInput } from '~/components/molecules/FileInput'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { selectId } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'
import { useCustomOptionalForm } from '~/utils/useCustomForm'
import { FormField } from '../components/ui/form'

const supportSchema = z.object({
  name: z.string().min(1),
})

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
  if (!params.support) {
    return forceRedirectError(request.headers, 'No document id provided')
  }
  const supportId = parseInt(params.support)
  const { errors, data } = await parseMutliForm(request, supportSchema, 'supports')
  if (errors || !data) {
    return { errors }
  }
  const newFile = data.file && data.file !== 'undefined'

  // NOTE: THIS IS DANGEROUS
  const support = await selectId<{ url: string }>(
    db,
    'select url from supports WHERE id = ?',
    supportId,
  )

  if (newFile) {
    await db.execute(`UPDATE supports SET name = ?, url = ? WHERE id = ?`, [
      data.name,
      data.file,
      supportId,
    ])
  } else {
    await db.execute(`UPDATE supports SET name = ? WHERE id = ?`, [
      data.name,
      supportId,
    ])
  }
  if (support?.url && newFile) {
    deleteFile(support.url)
  }
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Support Edited'))
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
  if (!params.support) {
    return forceRedirectError(request.headers, 'No document id provided')
  }
  const supportId = parseInt(params.support)

  const support = await selectId<{ name: string; url: string }>(
    db,
    'select name, url from supports WHERE id = ?',
    supportId,
  )
  return {
    name: support?.name,
    url: support?.url,
  }
}

export default function SupportsEdit() {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const { name, url } = useLoaderData<typeof loader>()

  const form = useCustomOptionalForm(supportSchema, supportSchema.parse({ name, url }))
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Edit Support</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <InputItem
                name='Name'
                placeholder={'Name of the support'}
                field={field}
              />
            )}
          />

          <FormField
            control={form.control}
            name='file'
            render={({ field }) => (
              <FileInput
                type='image'
                inputName='supports'
                id='image'
                onChange={field.onChange}
              />
            )}
          />
          <img src={url} alt={name} className='w-48  mx-auto' />
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Save Changes</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  )
}
