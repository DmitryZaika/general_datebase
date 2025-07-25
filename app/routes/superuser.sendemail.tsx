import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { sendEmail } from '~/lib/email.server'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { getSuperUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormProvider,
} from '../components/ui/form'

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().min(1, 'Email body is required'),
})

type FormData = z.infer<typeof emailSchema>
const resolver = zodResolver(emailSchema)

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getSuperUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const session = await getSession(request.headers.get('Cookie'))
  try {
    await csrf.validate(request)
  } catch (error) {
    session.flash('message', toastData('Error', 'Invalid CSRF token'))
    return redirect('.', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }
  try {
    await sendEmail(data)
  } catch (error) {
    console.error('Error sending email: ', error)
    session.flash('message', toastData('Error', 'Failed to send email'))
    return redirect('.', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }
  session.flash('message', toastData('Success', 'Email sent'))
  return redirect('.', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getSuperUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  return {}
}

export default function SuperuserSendEmail() {
  const actionData = useActionData<typeof action>()
  const token = useAuthenticityToken()
  const form = useForm<FormData>({
    resolver,
    defaultValues: actionData?.receivedValues,
  })
  const fullSubmit = useFullSubmit(form)

  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit} className='container mx-auto py-5 max-w-md'>
        <h1 className='text-2xl font-bold mb-4'>Send Email</h1>
        <FormField
          control={form.control}
          name='to'
          render={({ field }) => (
            <InputItem name='To' field={field} placeholder='recipient@example.com' />
          )}
        />
        <FormField
          control={form.control}
          name='subject'
          render={({ field }) => (
            <InputItem name='Subject' field={field} placeholder='Email subject' />
          )}
        />
        <FormField
          control={form.control}
          name='text'
          render={({ field }) => (
            <FormItem className='py-2'>
              <FormLabel>Body</FormLabel>
              <FormControl>
                <Textarea placeholder='Email body' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit'>Send Email</Button>
      </Form>
    </FormProvider>
  )
}
