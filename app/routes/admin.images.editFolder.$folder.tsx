import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'
import { FormField, FormProvider } from '../components/ui/form'

const folderSchema = z.object({
  name: z.string().min(1),
})

const resolver = zodResolver(folderSchema)

export async function action({ request, params }: ActionFunctionArgs) {
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

  if (!params.folder) {
    return forceRedirectError(request.headers, 'No folder id provided')
  }
  const folderId = parseInt(params.folder, 10)
  const { errors, data } = await getValidatedFormData(request, resolver)
  if (errors || !data) {
    return { errors }
  }

  const folderRows = await selectMany<{ id: number }>(
    db,
    `SELECT id FROM images_folders WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
    [folderId, user.company_id],
  )
  if (!folderRows[0]) {
    return forceRedirectError(request.headers, 'Folder not found')
  }

  await db.execute(
    `UPDATE images_folders SET name = ? WHERE id = ? AND company_id = ?`,
    [data.name, folderId, user.company_id],
  )

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Folder edited'))
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
  if (!folder) {
    return forceRedirectError(request.headers, 'Folder not found')
  }
  return {
    name: folder.name,
  }
}

export default function ImagesEditFolder() {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const { name } = useLoaderData<typeof loader>()
  const form = useForm({
    resolver,
    defaultValues: { name },
  })
  const fullSubmit = useFullSubmit(form)

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form method='post' onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <InputItem
                  name='Name'
                  placeholder={'Name of the folder'}
                  field={field}
                />
              )}
            />
            <DialogFooter>
              <LoadingButton loading={isSubmitting}>Save Changes</LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
