import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
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
import { DIALOG_CONTENT_ADD_EDIT_CLASS } from '~/utils/constants'
import { csrf } from '~/utils/csrf.server'
import { auditDisplayName } from '~/utils/customerAudit.server'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'
import { FormField, FormProvider } from '../components/ui/form'

const folderSchema = z.object({
  name: z.string().min(1),
})

const resolver = zodResolver(folderSchema)

export async function action({ request }: ActionFunctionArgs) {
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
  const { errors, data } = await getValidatedFormData(request, resolver)
  if (errors || !data) {
    return { errors }
  }

  const createdBy = auditDisplayName(user)
  await db.execute(
    `INSERT INTO images_folders (name, company_id, created_by) VALUES (?, ?, ?)`,
    [data.name, user.company_id, createdBy],
  )
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Folder added'))

  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  return null
}

export default function ImagesAddFolder() {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const form = useForm({
    resolver,
    defaultValues: { name: '' },
  })
  const fullSubmit = useFullSubmit(form)

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className={DIALOG_CONTENT_ADD_EDIT_CLASS}>
        <DialogHeader>
          <DialogTitle>Add Folder</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form method='post' onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <InputItem
                  inputAutoFocus={true}
                  name={'Name*'}
                  placeholder={'Name of the folder'}
                  field={field}
                />
              )}
            />
            <DialogFooter>
              <LoadingButton loading={isSubmitting}>Add Folder</LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
