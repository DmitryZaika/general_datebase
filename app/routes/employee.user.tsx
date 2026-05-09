import { zodResolver } from '@hookform/resolvers/zod'
import bcrypt from 'bcryptjs'
import { motion } from 'framer-motion'
import { Copy, Send } from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  Link,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigation,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import { FormField, FormProvider } from '~/components/ui/form'
import { Textarea } from '~/components/ui/textarea'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import {
  EMPLOYEE_VIEW_ENTER_EASE,
  employeeViewMotionKey,
} from '~/utils/employeeViewEnterMotion'
import { getQboUrl } from '~/utils/quickbooks.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone_number: z.union([z.coerce.string().min(10), z.literal('')]).optional(),
  email: z.email('Invalid email address'),
  password: z.union([z.string(), z.null(), z.undefined()]).optional(),
  email_signature: z.string().optional(),
  email_name: z.string().optional(),
  cloudtalk_agent_id: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const t = (val ?? '').trim()
      if (t.length > 36) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CloudTalk agent ID must be at most 36 characters',
        })
      }
    })
    .transform((val): string | null => {
      const t = (val ?? '').trim()
      return t === '' ? null : t
    }),
})

const resolver = zodResolver(userSchema)

const ACCOUNT_SLIDE_UP = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: EMPLOYEE_VIEW_ENTER_EASE },
}

interface UserData extends RowDataPacket {
  name: string | null
  email: string | null
  phone_number: string | null
  email_signature: string | null
  email_name: string | null
  cloudtalk_agent_id: string | null
  telegram_id: boolean
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)

    try {
      await csrf.validate(request)
    } catch {
      return { error: 'Invalid CSRF token' }
    }

    const { errors, data, receivedValues } = await getValidatedFormData(
      request,
      resolver,
    )

    if (errors) {
      return { errors, receivedValues }
    }

    const updateFields = [
      'name = ?',
      'email = ?',
      'phone_number = ?',
      'email_name = ?',
      'email_signature = ?',
      'cloudtalk_agent_id = ?',
    ]
    const params = [
      data.name,
      data.email,
      data.phone_number ?? null,
      data.email_name ?? null,
      data.email_signature ?? null,
      data.cloudtalk_agent_id,
    ]

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
      `SELECT name, email, phone_number, email_signature, email_name, cloudtalk_agent_id, CASE WHEN telegram_id IS NULL THEN false ELSE true END as telegram_id FROM users WHERE id = ? AND is_deleted = 0`,
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
    quickBooksUrl = undefined
  }
  return { userData: rows[0], quickBooksUrl }
}

function TelegramLink({ email }: { email: string }) {
  const userEmail = encodeURIComponent(email)
  const commandText = `/email ${email}`

  const handleCopy = () => {
    navigator.clipboard.writeText(commandText)
  }

  return (
    <div>
      <Link to={`https://t.me/granitemanager_bot?start=${userEmail}`}>
        {' '}
        <Button>
          <Send className='mr-2' size={16} />
          Connect to Telegram Bot
        </Button>
      </Link>
      <div className='mt-2 flex items-center gap-2 p-2 bg-gray-100 rounded border w-80'>
        <code className='flex-1 text-sm font-mono'>{commandText}</code>
        <Button variant='ghost' size='sm' onClick={handleCopy} className='p-1 h-auto'>
          <Copy size={14} />
        </Button>
      </div>
    </div>
  )
}

export default function UserProfile() {
  const { userData } = useLoaderData<typeof loader>()
  const location = useLocation()
  const navigation = useNavigation()
  const isSubmitting = navigation.state !== 'idle'
  const token = useAuthenticityToken()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const form = useForm({
    resolver,
    defaultValues: {
      name: userData.name || '',
      phone_number: userData.phone_number || '',
      email: userData.email || '',
      password: '',
      email_signature: userData.email_signature || '',
      email_name: userData.email_name || '',
      cloudtalk_agent_id: userData.cloudtalk_agent_id ?? '',
    },
  })

  const fullSubmit = useFullSubmit(form)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [userData.email_signature])

  return (
    <motion.div
      key={employeeViewMotionKey(location.pathname, location.search)}
      className='container py-5 w-full min-h-0'
      {...ACCOUNT_SLIDE_UP}
    >
      <h1 className='text-2xl  font-bold mb-6 ml-3'>My Account</h1>

      <div className='bg-card  rounded-lg shadow p-6 w-full'>
        {!userData.telegram_id && userData.email && (
          <TelegramLink email={userData.email} />
        )}
        <h2 className='text-xl font-semibold mb-4'>Personal Information</h2>
        {/*
        {data ? (
          <p>Logged into: {data?.CompanyInfo?.CompanyName}</p>
        ) : (
          <Button asChild>
            <a>Authorize Quickbooks</a>
          </Button>
        )} */}

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
              <FormField
                control={form.control}
                name='email_name'
                render={({ field }) => (
                  <InputItem
                    name='Email Name'
                    placeholder='Your email name'
                    field={field}
                  />
                )}
              />
              <FormField
                control={form.control}
                name='cloudtalk_agent_id'
                render={({ field }) => (
                  <InputItem
                    name='CloudTalk agent ID'
                    placeholder='From CloudTalk (optional)'
                    field={field}
                  />
                )}
              />
              <FormField
                control={form.control}
                name='email_signature'
                render={({ field }) => (
                  <div className='space-y-2'>
                    <div className='text-sm font-medium'>Email Signature</div>
                    <Textarea
                      {...field}
                      value={field.value || ''}
                      placeholder='Your signature'
                      ref={e => {
                        field.ref(e)
                        textareaRef.current = e
                      }}
                      onChange={e => {
                        field.onChange(e)
                        if (textareaRef.current) {
                          textareaRef.current.style.height = 'auto'
                          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
                        }
                      }}
                      className='min-h-25 resize-none overflow-hidden'
                    />
                  </div>
                )}
              />
            </div>

            <div className='mt-6 flex items-center gap-4'>
              <LoadingButton loading={isSubmitting} type='submit'>
                Save Changes
              </LoadingButton>
              <Link to='/logout'>
                <Button variant='destructive' type='button'>
                  Logout
                </Button>
              </Link>
            </div>
          </Form>
        </FormProvider>
      </div>
    </motion.div>
  )
}
