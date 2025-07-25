import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
// @ts-ignore
import bcrypt from 'bcryptjs'
import type { RowDataPacket } from 'mysql2'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import { FormField, FormProvider } from '~/components/ui/form'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { getQboUrl } from '~/utils/quickbooks.server'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone_number: z.union([z.coerce.string().min(10), z.literal('')]).optional(),
  email: z.string().email('Invalid email address'),
  password: z.union([z.string(), z.null(), z.undefined()]).optional(),
})

type FormData = z.infer<typeof userSchema>
const resolver = zodResolver(userSchema)

interface UserData extends RowDataPacket {
  name: string | null
  email: string | null
  phone_number: string | null
}

async function getCompanyInfo(): Promise<{ CompanyInfo: { CompanyName: string } }> {
  const result = await fetch('/api/quickbooks/company-info')
  if (!result.ok) {
    throw new Error(await result.text())
  }
  const data = await result.json()

  return data
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)

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

    const updateFields = ['name = ?', 'email = ?', 'phone_number = ?']
    const params = [data.name, data.email, data.phone_number]

    // Only hash and update password if provided
    if (data.password && data.password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(data.password, 10)
      updateFields.push('password = ?')
      params.push(hashedPassword)
    }

    // Add user ID to params
    params.push(String(user.id))

    await db.execute(
      `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = ?
      `,
      params,
    )

    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Success', 'Your account was updated'))
    return redirect('/employee/user', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  let user: User, rows: UserData[]
  try {
    user = await getEmployeeUser(request)

    ;[rows] = await db.query<UserData[]>(
      `SELECT name, email, phone_number FROM users WHERE id = ?`,
      [user.id],
    )

    if (!rows || rows.length === 0) {
      throw new Error('User not found')
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  let quickBooksUrl = null
  try {
    quickBooksUrl = await getQboUrl(request, user.company_id)
  } catch {
    quickBooksUrl = null
  }
  return { userData: rows[0], quickBooksUrl }
}

export default function UserProfile() {
  const { userData, quickBooksUrl } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state !== 'idle'
  const token = useAuthenticityToken()

  const { data } = useQuery({
    queryKey: ['qbo', 'companyInfo'],
    queryFn: getCompanyInfo,
  })

  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      name: userData.name || '',
      phone_number: userData.phone_number || '',
      email: userData.email || '',
      password: '',
    },
  })

  const fullSubmit = useFullSubmit(form)

  return (
    <div className='container  py-5'>
      <h1 className='text-2xl  font-bold mb-6 ml-3'>My Account</h1>
      <div className='bg-card  rounded-lg shadow p-6 w-full'>
        <h2 className='text-xl font-semibold mb-4'>Personal Information</h2>

        {data ? (
          <p>Logged into: {data?.CompanyInfo?.CompanyName}</p>
        ) : (
          <Button asChild>
            <a href={quickBooksUrl}>Authorize Quickbooks</a>
          </Button>
        )}
        <FormProvider {...form}>
          <Form method='post' onSubmit={fullSubmit}>
            <input type='hidden' name='csrf' value={token} />

            <div className='space-y-4 max-w-lg'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <InputItem name='Name' placeholder='Your name' field={field} />
                )}
              />

              <FormField
                control={form.control}
                name='phone_number'
                render={({ field }) => (
                  <InputItem
                    name='Phone'
                    placeholder='Your phone number'
                    field={field}
                  />
                )}
              />

              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <InputItem
                    name='Email'
                    placeholder='Your email address'
                    field={field}
                  />
                )}
              />

              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <InputItem
                    name='Password'
                    type='password'
                    placeholder='Leave empty to keep current password'
                    field={field}
                  />
                )}
              />
            </div>

            <div className='mt-6'>
              <LoadingButton loading={isSubmitting} type='submit'>
                Save Changes
              </LoadingButton>
            </div>
          </Form>
        </FormProvider>
      </div>
    </div>
  )
}
