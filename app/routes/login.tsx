import { zodResolver } from '@hookform/resolvers/zod'
import type { RowDataPacket } from 'mysql2'
import { FormProvider, useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  Link,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { PasswordInput } from '~/components/molecules/PasswordInput'
import { DialogFooter } from '~/components/ui/dialog'
import { FormField } from '~/components/ui/form'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser, login } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

const userSchema = z.object({
  email: z.string().email(),
  password: z.coerce.string().min(4),
})

type FormData = z.infer<typeof userSchema>

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
    return redirect('/employee')
  } catch {
    // ignore
  }
  const { searchParams } = new URL(request.url)
  const error = searchParams.get('error')
  return { error }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await csrf.validate(request)
  } catch (e) {
    return { error: String(e) }
  }
  const {
    errors,
    data,
    receivedValues: defaultValues,
  } = await getValidatedFormData<FormData>(request, zodResolver(userSchema))
  if (errors) {
    return { errors, defaultValues }
  }

  const sessionId = await login(data.email, data.password, 60 * 60 * 24 * 7 * 30 * 12)
  if (!sessionId) {
    return {
      error: 'Incorrect email or password. Please try again.',
      defaultValues: { ...defaultValues, password: '' },
    }
  }
  const session = await getSession(request.headers.get('Cookie'))
  session.set('sessionId', sessionId)

  const [row] = await db.execute<(RowDataPacket & { position: string | null })[]>(
    `SELECT p.name AS position
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
     WHERE u.email = ? LIMIT 1`,
    [data.email],
  )
  const position = row?.[0]?.position ?? null

  session.flash('message', toastData('Success', 'Logged in'))

  const redirectPath = position === 'installer' ? '/installers/checklist' : '..'
  return redirect(redirectPath, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function Login() {
  const navigation = useNavigation()
  const { error } = useLoaderData<{ error: string | null }>()
  const actionData = useActionData<typeof action>()
  const form = useForm<FormData>({
    resolver: zodResolver(userSchema),
    defaultValues: actionData?.defaultValues || { email: '', password: '' },
  })
  const fullSubmit = useFullSubmit(form)
  const isSubmitting = navigation.state !== 'idle'

  return (
    <div className='flex flex-col items-center justify-center p-20'>
      <Link
        to='/customer/1/stones'
        className='pb-4 text-blue-500 underline cursor-pointer'
      >
        For Customers
      </Link>
      <FormProvider {...form}>
        <Form
          className='w-full max-w-sm bg-white p-6 shadow-md rounded'
          method='post'
          onSubmit={fullSubmit}
        >
          {(error || actionData?.error) && (
            <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded'>
              {error || actionData?.error}
            </div>
          )}
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <InputItem name='Email' placeholder='Email' field={field} />
            )}
          />
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <PasswordInput name='password' placeholder='Password' field={field} />
            )}
          />
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Login</LoadingButton>
          </DialogFooter>
        </Form>
      </FormProvider>
    </div>
  )
}
