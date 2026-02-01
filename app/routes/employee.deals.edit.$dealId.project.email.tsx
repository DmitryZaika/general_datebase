// ============================================================================
// IMPORTS
// ============================================================================

// External Dependencies
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import {
  FileText,
  ImageIcon,
  MoreVertical,
  PaperclipIcon,
  SendIcon,
  SettingsIcon,
  Sparkles,
} from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { AiImproveButton } from '~/components/molecules/AiImproveButton'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
import {
  type EmailTemplate,
  EmailTemplateSearch,
} from '~/components/molecules/EmailTemplateSearch'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { QuillInput } from '~/components/molecules/QuillInput'
import { Badge } from '~/components/ui/badge'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
// Server Utilities
import { db } from '~/db.server'
import { useToast } from '~/hooks/use-toast'
import { fetchTemplateVariableData } from '~/services/templateVariables.server'
import {
  getUnfilledCustomVariables,
  hasAnyVariables,
  replaceTemplateVariables,
  type TemplateVariableData,
} from '~/utils/emailTemplateVariables'
import { getEmployeeUser, type User } from '~/utils/session.server'

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
  variationToken?: string
  skipHistory?: boolean
}

interface AIEmailResponse {
  subject?: string
  bodyText?: string
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const emailSchema = z.object({
  to: z.email('Valid email address is required'),
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().min(1, 'Email body is required'),
  attachments: z.array(z.instanceof(File)),
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
  let user: User
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

  const [senderInfo, templateVariableData] = await Promise.all([
    fetchSenderInfo(user),
    fetchTemplateVariableData({ user, dealId }),
  ])

  return {
    email: rows[0].email || '',
    customerName: rows[0].name || '',
    senderInfo,
    dealId,
    companyId: user.company_id || 0,
    templateVariableData,
  }
}

async function fetchSenderInfo(user: EmployeeUser): Promise<SenderInfo> {
  const senderInfo: SenderInfo = {}

  if (user.name) senderInfo.senderName = user.name
  if (user.email) senderInfo.senderEmail = user.email
  if (user.phone_number) senderInfo.senderPhoneNumber = user.phone_number

  if (user.company_id) {
    const [companyRows] = await db.execute<RowDataPacket[]>(
      'SELECT name FROM company WHERE id = ?',
      [user.company_id],
    )
    if (companyRows?.[0]?.name) senderInfo.senderCompany = companyRows[0].name
  }

  if (user.position_id) {
    const [positionRows] = await db.execute<RowDataPacket[]>(
      'SELECT name FROM positions WHERE id = ?',
      [user.position_id],
    )
    if (positionRows?.[0]?.name) senderInfo.senderPosition = positionRows[0].name
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
  const variationToken = Math.random().toString(36).slice(2)
  const payload: Partial<AIEmailRequest> = {
    emailCategory: formData.emailCategory,
    dealId: dealId,
    variationToken,
    skipHistory: true,
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
  companyId,
  selectedTemplate,
  onTemplateChange,
  templateVariableData,
}: {
  form: ReturnType<typeof useForm<EmailFormData>>
  companyId: number
  selectedTemplate: EmailTemplate | undefined
  onTemplateChange: (template: EmailTemplate | undefined) => void
  templateVariableData: TemplateVariableData
}) {
  const bodyText = form.watch('text')
  const customVariables = getUnfilledCustomVariables(bodyText)
  const showCustomVariablesInfo = selectedTemplate && customVariables.length > 0

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
      <EmailTemplateSearch
        companyId={companyId}
        value={selectedTemplate}
        onChange={template => {
          onTemplateChange(template)
          if (template) {
            form.setValue('subject', template.template_subject)
            const filledBody = replaceTemplateVariables(
              template.template_body,
              templateVariableData,
            )
            form.setValue('text', filledBody)
          }
        }}
      />
      <FormField
        control={form.control}
        name='text'
        render={({ field }) => (
          <QuillInput name='Body' field={field} className='mb-4' />
        )}
      />
      {showCustomVariablesInfo && (
        <div className='p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md'>
          <p>
            <strong>Action required:</strong> Please replace the following placeholders
            with actual values before sending:
          </p>
          <ul className='mt-1 list-disc list-inside'>
            {customVariables.map(variable => (
              <li key={variable}>
                <code className='bg-amber-100 px-1 rounded'>{`{{${variable}}}`}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AIAssistantMenu({
  aiForm,
}: {
  aiForm: ReturnType<typeof useForm<AIEmailFormData>>
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
// ====
function sendEmail(
  to: string,
  subject: string,
  body: string,
  dealId: number,
  attachments: File[],
) {
  const formData = new FormData()
  formData.append('to', to)
  formData.append('subject', subject)
  formData.append('body', body)
  formData.append('dealId', dealId.toString())

  for (const file of attachments) {
    // если на бэке ожидается массив
    formData.append('attachments', file)
    // либо attachments[] — зависит от реализации сервера
    // formData.append('attachments[]', file)
  }

  return fetch('/api/employee/sendEmail', {
    method: 'POST',
    body: formData,
  }).then(res => {
    if (!res.ok) throw new Error('Failed to send email')
    return res.json()
  })
}

export default function DealEmailDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const { email, dealId, companyId, templateVariableData } =
    useLoaderData<typeof loader>()
  const [showAIMenu, setShowAIMenu] = useState(false)
  const [_isGenerating, setIsGenerating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: EmailFormData) => {
      return sendEmail(
        values.to,
        values.subject,
        values.text,
        dealId,
        values.attachments,
      )
    },
    onSuccess: () => {
      navigate(`../${location.search}`)
      toast({
        title: 'Success',
        description: 'Email sent',
        variant: 'success',
      })
    },
    onError: () => {
      toast({
        title: 'Failure',
        description: 'Email could not be sent',
        variant: 'destructive',
      })
    },
  })

  const isSubmitting = useNavigation().state !== 'idle'

  const form = useForm<EmailFormData>({
    resolver: emailResolver,
    defaultValues: {
      to: email,
      subject: '',
      text: '',
      attachments: [],
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

  const fullSubmit = (values: EmailFormData) => {
    if (hasAnyVariables(values.text)) {
      form.setError('text', {
        message:
          'Please replace all {{placeholders}} with actual values before sending',
      })
      return
    }

    const lowerText = values.text.toLowerCase().trim()
    const hasAttachmentKeywords =
      lowerText.includes('attachment') ||
      lowerText.includes('attached') ||
      lowerText.includes('file') ||
      lowerText.includes('files') ||
      lowerText.includes('attachments')

    if (hasAttachmentKeywords && values.attachments.length === 0) {
      const confirmed = window.confirm("You didn't attach anything, is that fine?")
      if (!confirmed) return
    }
    mutate(values)
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) navigate(`../${location.search}`)
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
        subject => form.setValue('subject', subject ?? ''),
        body => form.setValue('text', body ?? ''),
      )
    } catch (error) {
      alert(
        `Failed to generate AI email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const removeAttachment = (file: File) => {
    form.setValue(
      'attachments',
      form.getValues('attachments').filter(f => f !== file),
    )
  }

  const formatFileName = (name: string) => {
    if (name.length <= 15) return name
    return `${name.slice(0, 15)}...`
  }

  const imageExt = new Set([
    'png',
    'jpg',
    'jpeg',
    'webp',
    'gif',
    'bmp',
    'svg',
    'heic',
    'heif',
    'tiff',
    'tif',
  ])

  function attachmentIcon(fileName: string) {
    const parts = fileName.split('.')
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
    if (ext && imageExt.has(ext)) return <ImageIcon className='h-4 w-4' />
    return <FileText className='h-4 w-4' />
  }

  return (
    <Dialog open={true} onOpenChange={handleDialogClose}>
      <DialogContent className='sm:max-w-[700px] overflow-auto flex flex-col min-h-[500px] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form
            onSubmit={form.handleSubmit(fullSubmit)}
            className='flex-1 flex flex-col'
          >
            <AuthenticityTokenInput />
            <EmailFormFields
              form={form}
              companyId={companyId}
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
              templateVariableData={templateVariableData}
            />
            {form.watch('attachments').length > 0 ? (
              <TooltipProvider>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {form.watch('attachments').map(file => {
                    const isTruncated = file.name.length > 15
                    const displayName = formatFileName(file.name)
                    const badge = (
                      <Badge
                        key={`${file.name}`}
                        className='cursor-pointer select-none'
                        onClick={() => removeAttachment(file)}
                      >
                        <span className='flex items-center gap-1'>
                          {attachmentIcon(file.name)}
                          <span>{displayName}</span>
                          <span className='ml-1'>×</span>
                        </span>
                      </Badge>
                    )

                    if (!isTruncated) return badge

                    return (
                      <Tooltip key={`${file.name}-${file.size}-${file.lastModified}`}>
                        <TooltipTrigger asChild>{badge}</TooltipTrigger>
                        <TooltipContent side='top'>{file.name}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </TooltipProvider>
            ) : null}
            <input
              ref={fileInputRef}
              type='file'
              className='hidden'
              multiple
              onChange={e => {
                const files = e.currentTarget.files
                if (files && files.length > 0) {
                  form.setValue('attachments', [
                    ...form.getValues('attachments'),
                    ...Array.from(files),
                  ])
                }
                e.currentTarget.value = ''
              }}
            />
            <div className='mt-4 flex justify-between gap-2 w-full'>
              <div className='flex items-center gap-2'>
                <CustomDropdownMenu
                  trigger={
                    <Button variant='outline' size='sm' className='h-9'>
                      <MoreVertical className='h-4 w-4 mr-1' />
                      AI Menu
                    </Button>
                  }
                  sections={[
                    {
                      title: 'AI Actions',
                      options: [
                        {
                          label: 'AI Settings',
                          icon: <SettingsIcon className='w-4 h-4' />,
                          onClick: () => setShowAIMenu(!showAIMenu),
                        },
                        {
                          label: 'Generate',
                          icon: <Sparkles className='w-4 h-4' />,
                          onClick: handleGenerateWithAI,
                        },
                      ],
                    },
                  ]}
                />
              </div>

              <div className='ml-auto flex items-center gap-2'>
                <AiImproveButton
                  getText={() => form.getValues('text')}
                  setText={value => form.setValue('text', value)}
                />
                <Button
                  type='button'
                  size='icon'
                  aria-label='Attachment'
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PaperclipIcon className='h-4 w-4' />
                </Button>
                <LoadingButton loading={isSubmitting || isPending} type='submit'>
                  <SendIcon className='h-4 w-4' />
                </LoadingButton>
              </div>
            </div>
          </Form>
        </FormProvider>
        {showAIMenu && (
          <div className='mt-4'>
            <AIAssistantMenu aiForm={aiForm} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
