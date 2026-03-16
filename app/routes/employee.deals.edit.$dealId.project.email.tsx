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
  Package,
  PaperclipIcon,
  SendIcon,
  SettingsIcon,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useEffect, useRef, useState } from 'react'
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
import { AttachmentImagePicker } from '~/components/AttachmentImagePicker'
import { AiImproveButton } from '~/components/molecules/AiImproveButton'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
import {
  type EmailTemplate,
  EmailTemplateSearch,
} from '~/components/molecules/EmailTemplateSearch'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { QuillInput } from '~/components/molecules/QuillInput'
import { Button } from '~/components/ui/button'
// Server Utilities
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { db } from '~/db.server'
import { useIsMobile } from '~/hooks/use-mobile'
import { useToast } from '~/hooks/use-toast'
import { useArrowCarousel } from '~/hooks/useArrowToggle'
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
    companyId: user.company_id ?? 0,
    templateVariableData,
  }
}

async function fetchSenderInfo(user: EmployeeUser): Promise<SenderInfo> {
  const senderInfo: SenderInfo = {}

  if (user.name) senderInfo.senderName = user.name
  if (user.email) senderInfo.senderEmail = user.email
  if (user.phone_number) senderInfo.senderPhoneNumber = user.phone_number

  if (user.company_id !== undefined) {
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
  onFilesDrop,
}: {
  form: ReturnType<typeof useForm<EmailFormData>>
  companyId: number
  selectedTemplate: EmailTemplate | undefined
  onTemplateChange: (template: EmailTemplate | undefined) => void
  templateVariableData: TemplateVariableData
  onFilesDrop?: (files: File[]) => void
}) {
  const bodyText = form.watch('text')
  const customVariables = getUnfilledCustomVariables(bodyText)
  const showCustomVariablesInfo = selectedTemplate && customVariables.length > 0

  return (
    <div className='flex-1 space-y-2'>
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
          <QuillInput
            name='Body'
            field={field}
            className='mb-4'
            onFilesDrop={onFilesDrop}
          />
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
  }).then(async res => {
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      const msg =
        payload && typeof payload === 'object' && typeof payload.error === 'string'
          ? payload.error
          : 'Failed to send email'
      throw new Error(msg)
    }
    return payload
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
  const [showStonesPicker, setShowStonesPicker] = useState(false)
  const [showImagesPicker, setShowImagesPicker] = useState(false)
  const [showDocumentsPicker, setShowDocumentsPicker] = useState(false)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

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
    onError: (error: Error) => {
      toast({
        title: 'Failure',
        description: error.message || 'Email could not be sent',
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

  const isMobile = useIsMobile()

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

  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [imageViewerIndex, setImageViewerIndex] = useState<number | null>(null)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  useArrowCarousel(carouselApi)
  const attachments = form.watch('attachments')
  const carouselImages = attachments
    .map((file, index) => ({
      index,
      name: file.name,
      previewUrl: previews[`${file.name}-${file.size}-${file.lastModified}`],
    }))
    .filter((item): item is { index: number; name: string; previewUrl: string } =>
      Boolean(item.previewUrl),
    )
    .map(({ index, name, previewUrl }) => ({ id: index, url: previewUrl, name }))
  useEffect(() => {
    if (!carouselApi) return
    if (imageViewerIndex !== null) {
      const idx = carouselImages.findIndex(im => im.id === imageViewerIndex)
      if (idx !== -1) carouselApi.scrollTo(idx, true)
    }
    carouselApi.on('settle', () => {
      const slides = carouselApi.slidesInView()
      if (slides.length > 0 && carouselImages[slides[0]])
        setImageViewerIndex(carouselImages[slides[0]].id)
    })
  }, [carouselApi, imageViewerIndex, carouselImages])
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      addFiles(Array.from(files))
    }
    e.currentTarget.value = ''
  }

  const addFiles = (newFiles: File[]) => {
    form.setValue('attachments', [...form.getValues('attachments'), ...newFiles])

    newFiles.forEach(file => {
      const parts = file.name.split('.')
      const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
      if (ext && imageExt.has(ext)) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviews(prev => ({
            ...prev,
            [`${file.name}-${file.size}-${file.lastModified}`]: reader.result as string,
          }))
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const pastedFiles: File[] = []

    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile()
        if (file) pastedFiles.push(file)
      }
    }

    if (pastedFiles.length > 0) {
      addFiles(pastedFiles)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const related = e.relatedTarget
    if (!related || !(related instanceof Node) || !e.currentTarget.contains(related)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      addFiles(Array.from(files))
    }
  }

  const removeAttachment = (index: number) => {
    const attachments = form.getValues('attachments')
    const file = attachments[index]
    if (file) {
      const previewKey = `${file.name}-${file.size}-${file.lastModified}`
      setPreviews(prev => {
        const next = { ...prev }
        delete next[previewKey]
        return next
      })
    }
    form.setValue(
      'attachments',
      attachments.filter((_, i) => i !== index),
    )
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
    return <FileText className='h-8 sm:h-15 w-8 sm:w-15' />
  }

  return (
    <Dialog open={true} onOpenChange={handleDialogClose}>
      <DialogContent
        className={`sm:max-w-[700px] overflow-auto flex flex-col min-h-[500px] max-h-[95vh] p-5 transition-colors ${isDragging ? 'bg-blue-50 ring-2 ring-blue-300 ring-dashed' : ''}`}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
              onFilesDrop={files => addFiles(files)}
            />
            {form.watch('attachments').length > 0 ? (
              <div className='flex flex-wrap gap-2'>
                {form.watch('attachments').map((file, index) => {
                  const previewKey = `${file.name}-${file.size}-${file.lastModified}`
                  const previewUrl = previews[previewKey]
                  const uniqueKey = `att-${index}-${previewKey}`
                  return (
                    <div
                      key={uniqueKey}
                      className='group relative size-15 sm:size-25 shrink-0 rounded border border-border overflow-hidden'
                    >
                      <button
                        type='button'
                        className='absolute top-0 right-0 z-10 p-0.5 rounded-bl bg-black/60 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100 hover:bg-black/80'
                        onClick={e => {
                          e.stopPropagation()
                          removeAttachment(index)
                        }}
                        aria-label='Remove attachment'
                      >
                        <X className='h-3 w-3 sm:h-4 sm:w-4' />
                      </button>
                      {previewUrl ? (
                        <button
                          type='button'
                          className='size-full cursor-pointer block focus:outline-none'
                          onClick={e => {
                            e.stopPropagation()
                            setImageViewerIndex(index)
                          }}
                        >
                          <img
                            src={previewUrl}
                            alt={file.name}
                            className='size-full object-cover transition-all group-hover:grayscale group-hover:brightness-75'
                          />
                        </button>
                      ) : (
                        <div
                          className='size-full flex items-center justify-center bg-muted text-muted-foreground cursor-pointer group-hover:bg-muted/80 transition-colors'
                          onClick={() => removeAttachment(index)}
                        >
                          {attachmentIcon(file.name)}
                        </div>
                      )}
                      {previewUrl ? (
                        <div className='absolute inset-0 pointer-events-none bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                          <span className='text-white text-[10px] text-center line-clamp-2 break-all select-none'>
                            {file.name}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type='file'
              className='hidden'
              multiple
              onChange={handleFileChange}
            />
            <div className='mt-4 flex justify-between gap-2 w-full'>
              <div className='flex items-center gap-2'>
                {isMobile ? (
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
                ) : (
                  <div className='flex items-center gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-9'
                      onClick={() => setShowAIMenu(!showAIMenu)}
                    >
                      <SettingsIcon className='h-4 w-4 mr-1' />
                      AI Settings
                    </Button>
                    <LoadingButton
                      loading={_isGenerating}
                      type='button'
                      variant='default'
                      size='sm'
                      className='h-9'
                      onClick={handleGenerateWithAI}
                    >
                      <Sparkles className='h-4 w-4 mr-1' />
                      Generate
                    </LoadingButton>
                  </div>
                )}
              </div>

              <div className='ml-auto flex items-center gap-2'>
                <AiImproveButton
                  getText={() => form.getValues('text')}
                  setText={value => form.setValue('text', value)}
                />
                <CustomDropdownMenu
                  side='top'
                  trigger={
                    <Button type='button' size='icon' aria-label='Attachment'>
                      <PaperclipIcon className='h-4 w-4' />
                    </Button>
                  }
                  sections={[
                    {
                      options: [
                        {
                          label: 'Upload from computer',
                          icon: <Upload className='h-4 w-4' />,
                          onClick: () => fileInputRef.current?.click(),
                        },
                        {
                          label: 'From Stones',
                          icon: <Package className='h-4 w-4' />,
                          onClick: () => setShowStonesPicker(true),
                        },
                        {
                          label: 'From Images',
                          icon: <ImageIcon className='h-4 w-4' />,
                          onClick: () => setShowImagesPicker(true),
                        },
                        {
                          label: 'From Documents',
                          icon: <FileText className='h-4 w-4' />,
                          onClick: () => setShowDocumentsPicker(true),
                        },
                      ],
                    },
                  ]}
                />
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
        <AttachmentImagePicker
          type='stones'
          companyId={companyId}
          open={showStonesPicker}
          onClose={() => setShowStonesPicker(false)}
          onSelect={files => {
            addFiles(files)
            setShowStonesPicker(false)
          }}
          onAddFiles={addFiles}
        />
        <AttachmentImagePicker
          type='images'
          companyId={companyId}
          open={showImagesPicker}
          onClose={() => setShowImagesPicker(false)}
          onSelect={files => {
            addFiles(files)
            setShowImagesPicker(false)
          }}
        />
        <AttachmentImagePicker
          type='documents'
          companyId={companyId}
          open={showDocumentsPicker}
          onClose={() => setShowDocumentsPicker(false)}
          onSelect={files => {
            addFiles(files)
            setShowDocumentsPicker(false)
          }}
        />
        <Dialog
          open={imageViewerIndex !== null}
          onOpenChange={open => !open && setImageViewerIndex(null)}
        >
          <DialogContent
            closeClassName='z-50 top-40 sm:top-10 md:top-25 lg:top-10 right-0 sm:-right-15 md:-right-25 lg:-right-35 md:opacity-0 md:group-hover:opacity-100'
            className='flex flex-col justify-center items-center gap-3 bg-transparent group'
          >
            <DialogTitle className='sr-only'>Image Gallery</DialogTitle>
            <DialogDescription className='sr-only'>Image Gallery</DialogDescription>
            <Carousel
              className='max-w-screen max-h-screen w-screen h-screen lg:max-w-[90vw] 2xl:max-w-[60vw]'
              setApi={setCarouselApi}
              opts={{ dragFree: false }}
            >
              <CarouselContent>
                {carouselImages.map(image => (
                  <CarouselItem key={image.id}>
                    <div className='w-full relative select-none'>
                      <img
                        src={image.url}
                        alt={image.name}
                        className='w-full h-[85vh] md:h-[87vh] 2xl:h-[93vh] object-contain z-0 select-none'
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
