import { zodResolver } from '@hookform/resolvers/zod'
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
import { commitSession, getSession } from '~/sessions.server'
import { Positions } from '~/types'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import {
  getEmployeeUser,
  getUserBySessionId,
  login,
  type User,
} from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

const userSchema = z.object({
  email: z.email(),
  password: z.coerce.string().min(4),
})

const userResolver = zodResolver(userSchema)

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

async function getRedirectPath(user: User): Promise<string> {
  const positions = await selectMany<{ position_id: number }>(
    db,
    `SELECT position_id from users_positions where user_id = ?`,
    [user.id],
  )
  if (positions.length === 0) return '..'
  if (positions.length > 1) return '..'
  if (positions[0].position_id === Positions.ShopWorker) return '/shop/transactions'
  if (positions[0].position_id === Positions.Installer)
    return `/installers/${user.company_id}/checklist`
  if (positions[0].position_id === Positions.ExternalMarketing)
    return `/external/marketing/${user.company_id}/leads`
  return '..'
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
  } = await getValidatedFormData(request, userResolver)
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

  const user = await getUserBySessionId(sessionId)
  if (!user) {
    return {
      error: 'Failed to create session. Please try again.',
      defaultValues: { ...defaultValues, password: '' },
    }
  }

  session.flash('message', toastData('Success', 'Logged in'))

  const redirectPath = await getRedirectPath(user)
  return redirect(redirectPath, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function Login() {
  const navigation = useNavigation()
  const { error } = useLoaderData<{ error: string | null }>()
  const actionData = useActionData<typeof action>()
  const { email, password } = actionData?.defaultValues || { email: '', password: '' }
  const finalEmail: string = email || ''
  const form = useForm({
    resolver: userResolver,
    defaultValues: { email: finalEmail, password: password ?? '' },
  })
  const fullSubmit = useFullSubmit(form, undefined, 'POST', undefined, true)
  const isSubmitting = navigation.state !== 'idle'

  return (
    <div className='flex flex-col items-center justify-center p-5'>
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
