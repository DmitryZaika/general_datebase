import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  type MetaFunction,
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
import {
  GraniteManagerMarketingBackground,
  GraniteManagerMarketingHeader,
  MarketingSlideDown,
  useGraniteManagerCalendly,
} from '~/components/organisms/GraniteManagerMarketingShell'
import { DialogFooter } from '~/components/ui/dialog'
import { FormField } from '~/components/ui/form'
import { loginLogo } from '~/constants/logos'
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

export const meta: MetaFunction = () => {
  return [{ title: 'Login' }]
}

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
  const openDemo = useGraniteManagerCalendly()
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
    <GraniteManagerMarketingBackground fillViewport>
      <GraniteManagerMarketingHeader onDemo={openDemo} />
      <div className='flex min-h-0 flex-1 flex-col items-center justify-start gap-4 overflow-y-auto px-4 py-6'>
        <MarketingSlideDown delay={0}>
          <img
            src={loginLogo}
            alt='Granite Manager'
            className=' shrink-0  object-contain h-30 sm:h-35 md:h-40 '
          />
        </MarketingSlideDown>
        {/* <MarketingSlideDown delay={100}>
           <Link
            to='/customers/companies'
            className='shrink-0 text-md font-medium text-slate-600 underline hover:text-slate-900'
          >
            For Customers
          </Link> }
        </MarketingSlideDown> */}
        <MarketingSlideDown delay={200} className='w-full max-w-sm'>
          <FormProvider {...form}>
            <Form
              className='rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-lg backdrop-blur'
              method='post'
              onSubmit={fullSubmit}
            >
              <div className='mb-2 text-center'>
                <h1 className='mt-2 text-md sm:text-lg md:text-2xl font-bold tracking-tight text-slate-900'>
                  Sign in to Granite Manager
                </h1>
              </div>
              {(error || actionData?.error) && (
                <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-600'>
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
                <LoadingButton loading={isSubmitting} className='w-full'>
                  Login
                </LoadingButton>
              </DialogFooter>
            </Form>
          </FormProvider>
        </MarketingSlideDown>
      </div>
    </GraniteManagerMarketingBackground>
  )
}
