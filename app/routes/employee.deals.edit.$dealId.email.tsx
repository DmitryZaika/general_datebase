import { zodResolver } from '@hookform/resolvers/zod'
import type { RowDataPacket } from 'mysql2'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormProvider,
} from '~/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { sendEmail } from '~/lib/email.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().min(1, 'Email body is required'),
})

type FormData = z.infer<typeof emailSchema>
const resolver = zodResolver(emailSchema)

export async function action({ request, params }: ActionFunctionArgs) {
  let user
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const session = await getSession(request.headers.get('Cookie'))
  try {
    await csrf.validate(request)
  } catch {
    session.flash('message', toastData('Error', 'Invalid CSRF token'))
    return redirect('.', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }
  try {
    await sendEmail(data)
    await db.execute(
      `INSERT INTO emails (user_id, subject, body, message_id)
       VALUES (?, ?, ?, ?)`,
      [user.id, data.subject, data.text, dealId],
    )
  } catch {
    session.flash('message', toastData('Error', 'Failed to send email'))
    return redirect('.', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }
  session.flash('message', toastData('Success', 'Email sent'))
  return redirect('../history', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }

  const dealId = parseInt(params.dealId, 10)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.email
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ? AND d.deleted_at IS NULL`,
    [dealId],
  )
  if (!rows || rows.length === 0) {
    return redirect('/employee/deals')
  }
  return { email: rows[0].email || '' }
}

export default function DealEmailDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showSelect, setShowSelect] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const { email } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      to: email,
      subject: actionData?.receivedValues?.subject || '',
      text: actionData?.receivedValues?.text || '',
    },
  })

  const handleTemplateSelect = (value: string) => {
    setSelectedTemplate(value)
    
    if (value === 'first-contact') {
      form.setValue('subject', 'First contact')
      form.setValue('text', 'Hi,\n\nI wanted to follow up on our recent conversation regarding your project.\n\nPlease let me know if you have any questions.\n\nBest regards')
    } else if (value === 'follow-up') {
      form.setValue('subject', 'Follow-up')
      form.setValue('text', 'Hi,\n\nThank you for your interest. Please find attached the quote for your project.\n\nLet me know if you have any questions.\n\nBest regards')
    } else if (value === 'reply') {
      form.setValue('subject', 'Reply')
      form.setValue('text', 'Hi,\n\nI wanted to give you an update on your project status.\n\nEverything is progressing well.\n\nBest regards')
    }
  }
  
  const fullSubmit = useFullSubmit(form)

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`../project${location.search}`)
    }
  }

  const generateWithAI = () => {
    console.log('generateWithAI')
  }



  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[600px] overflow-auto flex flex-col min-h-[400px] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form onSubmit={fullSubmit} className='flex-1 flex flex-col'>
            <AuthenticityTokenInput />
            <div className='flex-1 space-y-4'>
              <FormField
                control={form.control}
                name='to'
                render={({ field }) => (
                  <InputItem
                    name='To'
                    field={field}
                    placeholder='recipient@example.com'
                    disabled={true}
                  />
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
                  <FormItem>
                    <FormLabel>Body</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Email body'
                        className='min-h-[200px]'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
      
            <DialogFooter className='mt-4 flex gap-2'>
              <div className="flex justify-between gap-2 w-full">
              {
                showSelect ? (
                  <div className="flex gap-2">
                        <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className='w-[250px]'>
                      <SelectValue placeholder='Select template' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='first-contact'>First contact</SelectItem>
                      <SelectItem value='follow-up'>Follow-up</SelectItem>
                      <SelectItem value='reply'>Reply</SelectItem>
                    </SelectContent>
                  </Select>
                  <LoadingButton type='button' loading={false} onClick={() => generateWithAI()}>Generate</LoadingButton>
                  </div>
                ) : (
                  <Button type='button' onClick={() => setShowSelect(true)}>Generate with AI</Button>
                )
              }
              <Button type='submit' >Send Email</Button>
              </div>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}

