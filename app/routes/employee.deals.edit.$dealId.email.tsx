// ============================================================================
// IMPORTS
// ============================================================================

// External Dependencies
import { zodResolver } from '@hookform/resolvers/zod'
import type { RowDataPacket } from 'mysql2'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
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

// UI Components
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
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

// Server Utilities
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { sendEmail } from '~/lib/email.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface EmployeeUser {
  id: number
  email: string
  name?: string | null
  phone_number?: string
  company_id?: number
  position_id?: number
}

interface SenderInfo {
  senderName?: string
  senderCompany?: string
  senderPosition?: string
  senderPhoneNumber?: string
  senderEmail?: string
}

interface AIEmailRequest {
  emailCategory:
    | 'first-contact'
    | 'follow-up'
    | 'reply'
    | 'promotional'
    | 'thank-you'
    | 'feedback-request'
    | 'referral'
  dealId: number
  formality?: 'formal' | 'neutral' | 'casual'
  tone?: 'friendly' | 'persuasive' | 'empathetic' | 'urgent'
  verboseness?: 'concise' | 'detailed'
  desiredContent?: string
  urgencyLevel?: 'low' | 'medium' | 'high'
  senderName?: string
  senderCompany?: string
  senderPosition?: string
  senderPhoneNumber?: string
  senderEmail?: string
}

interface AIEmailResponse {
  subject?: string
  bodyText?: string
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const emailSchema = z.object({
  to: z.string().email('Valid email address is required'),
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().min(1, 'Email body is required'),
})

type EmailFormData = z.infer<typeof emailSchema>
const emailResolver = zodResolver(emailSchema)

const aiEmailSchema = z.object({
  emailCategory: z.enum([
    'first-contact',
    'follow-up',
    'reply',
    'promotional',
    'thank-you',
    'feedback-request',
    'referral',
  ]),
  formality: z.enum(['formal', 'neutral', 'casual']).optional(),
  tone: z.enum(['friendly', 'persuasive', 'empathetic', 'urgent']).optional(),
  verboseness: z.enum(['concise', 'detailed']).optional(),
  desiredContent: z.string().optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
})

type AIEmailFormData = z.infer<typeof aiEmailSchema>

// ============================================================================
// SERVER-SIDE LOADER
// ============================================================================

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: EmployeeUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.email, c.name FROM deals d JOIN customers c ON d.customer_id = c.id WHERE d.id = ? AND d.deleted_at IS NULL`,
    [dealId],
  )

  if (!rows || rows.length === 0) {
    return redirect('/employee/deals')
  }

  const senderInfo = await fetchSenderInfo(user)

  return {
    email: rows[0].email || '',
    customerName: rows[0].name || '',
    senderInfo,
    dealId,
  }
}

// ============================================================================
// SERVER-SIDE ACTION HANDLER
// ============================================================================

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))

  let user: EmployeeUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  try {
    await csrf.validate(request)
  } catch {
    session.flash('message', toastData('Error', 'Invalid CSRF token'))
    return redirect('.', { headers: { 'Set-Cookie': await commitSession(session) } })
  }

  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)

  const { errors, data, receivedValues } = await getValidatedFormData<EmailFormData>(
    request,
    emailResolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }

  try {
    await sendEmail(data)
    await db.execute(
      `INSERT INTO emails (user_id, subject, body, message_id) VALUES (?, ?, ?, ?)`,
      [user.id, data.subject, data.text, dealId],
    )
  } catch (error) {
    console.error('Email send error:', error)
    session.flash('message', toastData('Error', 'Failed to send email'))
    return redirect('.', { headers: { 'Set-Cookie': await commitSession(session) } })
  }

  session.flash('message', toastData('Success', 'Email sent'))
  return redirect('../history', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

// ============================================================================
// DATABASE UTILITY FUNCTIONS
// ============================================================================

async function fetchSenderInfo(user: EmployeeUser): Promise<SenderInfo> {
  const senderInfo: SenderInfo = {}

  if (user.name) senderInfo.senderName = user.name
  if (user.email) senderInfo.senderEmail = user.email
  if (user.phone_number) senderInfo.senderPhoneNumber = user.phone_number

  if (user.company_id) {
    try {
      const [companyRows] = await db.execute<RowDataPacket[]>(
        'SELECT name FROM company WHERE id = ?',
        [user.company_id],
      )
      if (companyRows?.[0]?.name) senderInfo.senderCompany = companyRows[0].name
    } catch (error) {
      console.error('Error fetching company:', error)
    }
  }

  if (user.position_id) {
    try {
      const [positionRows] = await db.execute<RowDataPacket[]>(
        'SELECT name FROM positions WHERE id = ?',
        [user.position_id],
      )
      if (positionRows?.[0]?.name) senderInfo.senderPosition = positionRows[0].name
    } catch (error) {
      console.error('Error fetching position:', error)
    }
  }

  return senderInfo
}

// ============================================================================
// AI EMAIL GENERATION
// ============================================================================

function buildAIRequestPayload(
  formData: AIEmailFormData,
  dealId: number,
): Partial<AIEmailRequest> {
  const payload: Partial<AIEmailRequest> = {
    emailCategory: formData.emailCategory,
    dealId: dealId,
  }

  if (formData.formality) payload.formality = formData.formality
  if (formData.tone) payload.tone = formData.tone
  if (formData.verboseness) payload.verboseness = formData.verboseness
  if (formData.urgencyLevel) payload.urgencyLevel = formData.urgencyLevel
  if (formData.desiredContent?.trim()) payload.desiredContent = formData.desiredContent

  return payload
}

async function processStreamingResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onStreamSubject?: (text: string) => void,
  onStreamBody?: (text: string) => void,
): Promise<AIEmailResponse> {
  const decoder = new TextDecoder()
  let fullText = ''
  let isInBody = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.error) throw new Error(data.error)
          if (data.content) {
            fullText += data.content

            if (fullText.includes('---BODY---')) {
              isInBody = true
              const parts = fullText.split('---BODY---')
              if (onStreamSubject) onStreamSubject(parts[0].trim())
              if (onStreamBody) onStreamBody((parts[1] || '').trim())
            } else if (isInBody) {
              const parts = fullText.split('---BODY---')
              if (onStreamBody) onStreamBody((parts[1] || '').trim())
            } else {
              if (onStreamSubject) onStreamSubject(fullText.trim())
            }
          }
        } catch (parseError) {
          console.error('Parse error:', parseError)
        }
      }
    }
  }

  const parts = fullText.split('---BODY---')
  return { subject: parts[0]?.trim() || '', bodyText: parts[1]?.trim() || '' }
}

async function generateAIEmail(
  formData: AIEmailFormData,
  dealId: number,
  onStreamSubject?: (text: string) => void,
  onStreamBody?: (text: string) => void,
): Promise<AIEmailResponse> {
  const requestPayload = buildAIRequestPayload(formData, dealId)

  console.log(requestPayload)

  const response = await fetch('/api/aiRecommend/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to generate AI email: ${response.status} ${errorText}`)
  }

  if (!response.body) throw new Error('No response body')

  return processStreamingResponse(
    response.body.getReader(),
    onStreamSubject,
    onStreamBody,
  )
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

function EmailFormFields({
  form,
}: {
  form: ReturnType<typeof useForm<EmailFormData>>
}) {
  return (
    <div className='flex-1 space-y-4'>
      <FormField
        control={form.control}
        name='to'
        render={({ field }) => (
          <InputItem
            name='To'
            field={field}
            placeholder='recipient@example.com'
            disabled={false}
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
              <Textarea placeholder='Email body' className='min-h-[200px]' {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function AIAssistantMenu({
  aiForm,
  onGenerate,
  isGenerating,
}: {
  aiForm: ReturnType<typeof useForm<AIEmailFormData>>
  onGenerate: () => void
  isGenerating: boolean
}) {
  return (
    <div className='flex flex-col gap-4 p-4 border rounded-lg bg-gray-50'>
      <h3 className='font-semibold text-sm'>AI Email Assistant</h3>
      <FormProvider {...aiForm}>
        <div className='grid grid-cols-2 gap-3'>
          <FormField
            control={aiForm.control}
            name='emailCategory'
            render={({ field }) => (
              <FormItem className='space-y-1 mb-2'>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select category' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='first-contact'>First Contact</SelectItem>
                    <SelectItem value='follow-up'>Follow-up</SelectItem>
                    <SelectItem value='reply'>Reply</SelectItem>
                    <SelectItem value='promotional'>Promotional</SelectItem>
                    <SelectItem value='thank-you'>Thank You</SelectItem>
                    <SelectItem value='feedback-request'>Feedback Request</SelectItem>
                    <SelectItem value='referral'>Referral</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={aiForm.control}
            name='formality'
            render={({ field }) => (
              <FormItem className='space-y-1 mb-2'>
                <FormLabel>Formality</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select formality' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='formal'>Formal</SelectItem>
                    <SelectItem value='neutral'>Neutral</SelectItem>
                    <SelectItem value='casual'>Casual</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={aiForm.control}
            name='tone'
            render={({ field }) => (
              <FormItem className='space-y-1 mb-2'>
                <FormLabel>Tone</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select tone' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='friendly'>Friendly</SelectItem>
                    <SelectItem value='persuasive'>Persuasive</SelectItem>
                    <SelectItem value='empathetic'>Empathetic</SelectItem>
                    <SelectItem value='urgent'>Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={aiForm.control}
            name='verboseness'
            render={({ field }) => (
              <FormItem className='space-y-1 mb-2'>
                <FormLabel>Verboseness</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select verboseness' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='concise'>Concise</SelectItem>
                    <SelectItem value='detailed'>Detailed</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={aiForm.control}
            name='urgencyLevel'
            render={({ field }) => (
              <FormItem className='space-y-1 mb-2'>
                <FormLabel>Urgency Level</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select urgency' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='low'>Low</SelectItem>
                    <SelectItem value='medium'>Medium</SelectItem>
                    <SelectItem value='high'>High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={aiForm.control}
          name='desiredContent'
          render={({ field }) => (
            <InputItem
              name='Desired Content'
              placeholder='Describe what you want the email to cover...'
              field={field}
            />
          )}
        />
      </FormProvider>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DealEmailDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const { email, customerName, senderInfo, dealId } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const [showAIMenu, setShowAIMenu] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const form = useForm<EmailFormData>({
    resolver: emailResolver,
    defaultValues: {
      to: email,
      subject: actionData?.receivedValues?.subject || '',
      text: actionData?.receivedValues?.text || '',
    },
  })

  const aiForm = useForm<AIEmailFormData>({
    resolver: zodResolver(aiEmailSchema),
    defaultValues: {
      emailCategory: 'first-contact',
      formality: 'neutral',
      tone: 'friendly',
      verboseness: 'concise',
      desiredContent: '',
      urgencyLevel: 'medium',
    },
  })

  const fullSubmit = useFullSubmit(form)

  const handleDialogClose = (open: boolean) => {
    if (!open) navigate(`../project${location.search}`)
  }

  const handleGenerateWithAI = async () => {
    const isValid = await aiForm.trigger()
    if (!isValid) return

    setIsGenerating(true)
    form.setValue('subject', '')
    form.setValue('text', '')

    try {
      await generateAIEmail(
        aiForm.getValues(),
        dealId,
        subject => form.setValue('subject', subject),
        body => form.setValue('text', body),
      )
    } catch (error) {
      alert(
        `Failed to generate AI email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleDialogClose}>
      <DialogContent className='sm:max-w-[600px] overflow-auto flex flex-col min-h-[400px] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={fullSubmit} className='flex-1 flex flex-col'>
            <AuthenticityTokenInput />
            <EmailFormFields form={form} />
            <div className='mt-4 flex justify-between gap-2 w-full'>
              <Button
                type='button'
                onClick={() => setShowAIMenu(!showAIMenu)}
                variant={showAIMenu ? 'secondary' : 'default'}
              >
                {showAIMenu ? 'Hide' : 'Toggle'} AI Assistant Menu
              </Button>
              <LoadingButton
                type='button'
                loading={isGenerating}
                onClick={handleGenerateWithAI}
              >
                Generate
              </LoadingButton>
              <Button type='submit' className='ml-auto'>
                Send Email
              </Button>
            </div>
          </form>
        </FormProvider>
        {showAIMenu && (
          <div className='mt-4'>
            <AIAssistantMenu
              aiForm={aiForm}
              onGenerate={handleGenerateWithAI}
              isGenerating={isGenerating}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
