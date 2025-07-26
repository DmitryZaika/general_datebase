// app/routes/users.$user.tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { SelectInput } from '~/components/molecules/SelectItem'
import { SwitchItem } from '~/components/molecules/SwitchItem'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField, FormProvider } from '~/components/ui/form'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'
import { replaceUnderscoresWithSpaces } from '~/utils/words'

const userschema = z.object({
  name: z.string().min(1),
  phone_number: z.union([z.coerce.string().min(10), z.literal('')]).optional(),
  email: z.union([z.string().email().optional(), z.literal('')]),
  company_id: z.coerce.number(),
  position_id: z.coerce.number().optional(),
  is_admin: z.boolean(),
})

type FormData = z.infer<typeof userschema>
const resolver = zodResolver(userschema)

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
  if (!params.user) {
    return forceRedirectError(request.headers, 'No user id provided')
  }
  const userId = parseInt(params.user)
  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }
  await db.execute(
    `
    UPDATE users
    SET
      name = ?,
      email = ?,
      phone_number = ?,
      company_id = ?,
      is_admin = ?,
      position_id = ?
    WHERE id = ?
    `,
    [
      data.name,
      data.email,
      data.phone_number,
      data.company_id,
      data.is_admin,
      data.position_id,
      userId,
    ],
  )
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'User updated'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

interface Company {
  id: number
  name: string
}

interface User {
  id: number
  name: null | string
  email: null | string
  phone_number: null | string
  company_id: number
  position_id: number | null
  is_admin: null | number
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.user) {
    return forceRedirectError(request.headers, 'No user id provided')
  }
  const userId = parseInt(params.user)
  if (Number.isNaN(userId)) {
    return forceRedirectError(request.headers, 'Invalid user id')
  }
  const user = await selectId<User>(
    db,
    'SELECT id, name, email, phone_number, company_id, position_id, is_admin FROM users WHERE id = ?',
    userId,
  )
  if (!user) {
    return forceRedirectError(request.headers, 'Invalid user id')
  }
  const companies = await selectMany<Company>(db, 'SELECT id, name FROM company')
  const positions = await selectMany<{ id: number; name: string }>(
    db,
    'SELECT id, name FROM positions',
  )
  return {
    user,
    companies: companies.map(c => ({ key: c.id, value: c.name })),
    positions: positions.map(p => ({ key: p.id, value: p.name })),
  }
}

export default function User() {
  const navigate = useNavigate()
  const { user, companies, positions } = useLoaderData<{
    user: User
    companies: Array<{ key: number; value: string }>
    positions: Array<{ key: number; value: string }>
  }>()

  const token = useAuthenticityToken()
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      name: user.name || '',
      phone_number: user.phone_number || '',
      email: user.email || '',
      company_id: user.company_id,
      position_id: user.position_id || undefined,
      is_admin: user.is_admin === 1,
    },
  })

  const fullSubmit = useFullSubmit(form)
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate('..')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>User</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form method='post' onSubmit={fullSubmit}>
            <input type='hidden' name='csrf' value={token} />
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <InputItem name='Name' placeholder='Name' field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='phone_number'
              render={({ field }) => (
                <InputItem name='Phone' placeholder='Phone' field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <InputItem name='Email' placeholder='Email' field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='company_id'
              render={({ field }) => (
                <SelectInput field={field} name='Company' options={companies} />
              )}
            />
            <FormField
              control={form.control}
              name='position_id'
              render={({ field }) => (
                <SelectInput
                  field={field}
                  name='Position'
                  options={positions.map(position => ({
                    key: position.key,
                    value: replaceUnderscoresWithSpaces(position.value),
                  }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name='is_admin'
              render={({ field }) => <SwitchItem field={field} name='Admin' />}
            />
            <DialogFooter>
              <Button type='submit'>Save</Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
