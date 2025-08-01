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
import { commitSession, getSession } from '~/sessions'

import { csrf } from '~/utils/csrf.server'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'
import { FormField, FormProvider } from '../components/ui/form'

const supplierschema = z.object({
  website: z.union([z.string().url().optional(), z.literal('')]).optional(),
  supplier_name: z.string().min(1),
  manager: z.string().optional(),
  phone: z.union([z.coerce.string().min(10), z.literal('')]).optional(),
  email: z.union([z.string().email().optional(), z.literal('')]),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof supplierschema>

const resolver = zodResolver(supplierschema)

export async function action({ request }: ActionFunctionArgs) {
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

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }
  const user = getAdminUser(request)
  await db.execute(
    `INSERT INTO suppliers  (website, supplier_name, manager,  phone, email, notes, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.website,
      data.supplier_name,
      data.manager ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.notes ?? null,
      (await user).company_id,
    ],
  )
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'supplier added'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    return { user }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function SuppliersAdd() {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state === 'idle'
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      website: '',
      supplier_name: '',
      manager: '',
      phone: '',
      email: '',
      notes: '',
    },
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
          <DialogTitle>Add supplier</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id='customerForm' method='post' onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name='website'
              render={({ field }) => (
                <InputItem
                  inputAutoFocus={true}
                  name={'Website'}
                  placeholder={'Website'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='supplier_name'
              render={({ field }) => (
                <InputItem
                  name={'Supplier Name'}
                  placeholder={'Name of the supplier'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='manager'
              render={({ field }) => (
                <InputItem
                  name={'Manager'}
                  placeholder={'Name of the manager'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => (
                <InputItem
                  name={'Phone Number'}
                  placeholder={'Phone Number'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <InputItem name={'Email'} placeholder={'Email'} field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='notes'
              render={({ field }) => (
                <InputItem name={'Notes'} placeholder={'Notes'} field={field} />
              )}
            />
            <DialogFooter>
              <LoadingButton loading={!isSubmitting}>Add Stone</LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
