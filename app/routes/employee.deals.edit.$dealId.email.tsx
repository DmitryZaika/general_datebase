// ============================================================================
// Type Definitions & Schema
// ============================================================================

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
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { sendEmail } from '~/lib/email.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

/**
 * Zod schema for email form validation
 * Ensures email format, subject, and body are valid before submission
 */
const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().min(1, 'Email body is required'),
})

type FormData = z.infer<typeof emailSchema>
const resolver = zodResolver(emailSchema)

/**
 * Email template types available in the system
 */
type TemplateType = 'first-contact' | 'follow-up' | 'reply' | ''

/**
 * AI email generation request parameters
 */
interface AIEmailRequest {
  emailCategory:
    | 'first-contact'
    | 'follow-up'
    | 'reply'
    | 'promotional'
    | 'thank-you'
    | 'feedback-request'
    | 'referral'
  recipientName: string
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

/**
 * User data structure from authentication
 */
interface EmployeeUser {
  id: number
  email: string
  name?: string | null
  phone_number?: string
  company_id?: number
  position_id?: number
}

/**
 * Sender information for AI email generation
 */
interface SenderInfo {
  senderName?: string
  senderCompany?: string
  senderPosition?: string
  senderPhoneNumber?: string
  senderEmail?: string
}

/**
 * Zod schema for AI email generation form
 */
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

/**
 * AI email generation response structure
 */
interface AIEmailResponse {
  subject?: string
  bodyText?: string
}

// ============================================================================
// Server-Side Action Handler
// ============================================================================

/**
 * Handles email submission and database logging
 *
 * @param request - Incoming HTTP request
 * @param params - Route parameters containing dealId
 * @returns Redirect response with success/error toast
 *
 * Process:
 * 1. Authenticate user
 * 2. Validate CSRF token
 * 3. Validate form data
 * 4. Send email via email service
 * 5. Log email in database for audit trail
 * 6. Redirect to history page with success message
 */
export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'))

  // Authenticate user - redirect to login if not authenticated
  let user
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  // Validate CSRF token to prevent cross-site request forgery
  try {
    await csrf.validate(request)
  } catch {
    session.flash('message', toastData('Error', 'Invalid CSRF token'))
    return redirect('.', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  // Extract and validate deal ID from route params
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)

  // Validate form data against schema
  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }

  // Send email and log to database
  try {
    await sendEmail(data)

    // Store email in database with deal context for audit trail
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

  // Redirect to history page with success message
  session.flash('message', toastData('Success', 'Email sent'))
  return redirect('../history', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

// ============================================================================
// Server-Side Loader
// ============================================================================

/**
 * Loads customer email address and sender information associated with the deal
 *
 * @param request - Incoming HTTP request
 * @param params - Route parameters containing dealId
 * @returns Customer email address and sender information
 *
 * Retrieves the customer's email from the database by joining
 * deals and customers tables. Also fetches sender info for AI generation.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  // Authenticate user
  let user: EmployeeUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  // Validate deal ID parameter
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)

  // Fetch customer email associated with this deal
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.email, c.name
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ? AND d.deleted_at IS NULL`,
    [dealId],
  )

  // Redirect to deals list if deal not found
  if (!rows || rows.length === 0) {
    return redirect('/employee/deals')
  }

  // Fetch sender information from user data
  const senderInfo = await getSenderInfo(user)

  return {
    email: rows[0].email || '',
    customerName: rows[0].name || '',
    senderInfo,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Fetches sender information from database based on user data
 *
 * @param user - Authenticated employee user
 * @returns Promise resolving to sender information
 *
 * Looks up company name and position name from their respective tables
 * using foreign keys from the user object
 */
async function getSenderInfo(user: EmployeeUser): Promise<SenderInfo> {
  console.log('[getSenderInfo] Starting with user:', user)

  const senderInfo: SenderInfo = {}

  // Add name if available
  if (user.name) {
    senderInfo.senderName = user.name
    console.log('[getSenderInfo] Added name:', user.name)
  } else {
    console.log('[getSenderInfo] No name found in user object')
  }

  // Add email if available
  if (user.email) {
    senderInfo.senderEmail = user.email
    console.log('[getSenderInfo] Added email:', user.email)
  }

  // Add phone number if available
  if (user.phone_number) {
    senderInfo.senderPhoneNumber = user.phone_number
    console.log('[getSenderInfo] Added phone:', user.phone_number)
  }

  // Fetch company name if company_id exists
  if (user.company_id) {
    try {
      console.log('[getSenderInfo] Fetching company for company_id:', user.company_id)
      const [companyRows] = await db.execute<RowDataPacket[]>(
        'SELECT name FROM company WHERE id = ?',
        [user.company_id],
      )
      console.log('[getSenderInfo] Company query result:', companyRows)
      if (companyRows && companyRows.length > 0 && companyRows[0].name) {
        senderInfo.senderCompany = companyRows[0].name
        console.log('[getSenderInfo] Added company:', companyRows[0].name)
      }
    } catch (error) {
      console.error('[getSenderInfo] Error fetching company:', error)
    }
  }

  // Fetch position name if position_id exists
  if (user.position_id) {
    try {
      console.log(
        '[getSenderInfo] Fetching position for position_id:',
        user.position_id,
      )
      const [positionRows] = await db.execute<RowDataPacket[]>(
        'SELECT name FROM positions WHERE id = ?',
        [user.position_id],
      )
      console.log('[getSenderInfo] Position query result:', positionRows)
      if (positionRows && positionRows.length > 0 && positionRows[0].name) {
        senderInfo.senderPosition = positionRows[0].name
        console.log('[getSenderInfo] Added position:', positionRows[0].name)
      }
    } catch (error) {
      console.error('[getSenderInfo] Error fetching position:', error)
    }
  } else {
    console.log('[getSenderInfo] No position_id found in user object')
  }

  console.log('[getSenderInfo] Final senderInfo:', senderInfo)
  return senderInfo
}

/**
 * Generates AI-powered email content using the API with real-time streaming
 *
 * @param formData - User-provided AI generation parameters
 * @param senderInfo - Sender information from database
 * @param onStreamSubject - Callback for streaming subject
 * @param onStreamBody - Callback for streaming body
 * @returns Promise resolving to AI-generated email content
 * @throws Error if API request fails
 */
async function generateAIEmail(
  formData: AIEmailFormData,
  senderInfo: SenderInfo,
  recipientName: string,
  onStreamSubject?: (text: string) => void,
  onStreamBody?: (text: string) => void,
): Promise<AIEmailResponse> {
  console.log('[generateAIEmail] Starting with formData:', formData)
  console.log('[generateAIEmail] SenderInfo:', senderInfo)

  // Build request payload, excluding empty strings and undefined values
  const requestPayload: Partial<AIEmailRequest> = {
    emailCategory: formData.emailCategory,
    recipientName: recipientName || 'Customer',
  }
  if (formData.formality) {
    requestPayload.formality = formData.formality
  }
  if (formData.tone) {
    requestPayload.tone = formData.tone
  }
  if (formData.verboseness) {
    requestPayload.verboseness = formData.verboseness
  }
  if (formData.desiredContent && formData.desiredContent.trim()) {
    requestPayload.desiredContent = formData.desiredContent
  }
  if (formData.urgencyLevel) {
    requestPayload.urgencyLevel = formData.urgencyLevel
  }

  // Add sender info fields if they exist
  if (senderInfo.senderName && senderInfo.senderName.trim()) {
    requestPayload.senderName = senderInfo.senderName
  }
  if (senderInfo.senderCompany && senderInfo.senderCompany.trim()) {
    requestPayload.senderCompany = senderInfo.senderCompany
  }

  console.log(
    '[generateAIEmail] Request payload:',
    JSON.stringify(requestPayload, null, 2),
  )

  const response = await fetch('/api/aiRecommend/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
  })

  console.log('[generateAIEmail] Response status:', response.status)
  console.log('[generateAIEmail] Response ok:', response.ok)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[generateAIEmail] Error response:', errorText)
    throw new Error(`Failed to generate AI email: ${response.status} ${errorText}`)
  }

  // Handle streaming response
  if (response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let isInBody = false

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.error) {
                throw new Error(data.error)
              }

              if (data.content) {
                fullText += data.content

                // Check if we've hit the body separator
                if (fullText.includes('---BODY---')) {
                  isInBody = true
                  const parts = fullText.split('---BODY---')
                  const subject = parts[0].trim()
                  const body = parts[1] || ''

                  if (onStreamSubject) {
                    onStreamSubject(subject)
                  }
                  if (onStreamBody) {
                    onStreamBody(body.trim())
                  }
                } else if (isInBody) {
                  // We're in the body section
                  const parts = fullText.split('---BODY---')
                  const body = parts[1] || ''
                  if (onStreamBody) {
                    onStreamBody(body.trim())
                  }
                } else {
                  // Still in subject
                  if (onStreamSubject) {
                    onStreamSubject(fullText.trim())
                  }
                }
              }

              if (data.done) {
                console.log('[generateAIEmail] Streaming complete')
              }
            } catch (parseError) {
              console.error('[generateAIEmail] Parse error:', parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error('[generateAIEmail] Streaming error:', error)
      throw error
    }

    // Parse the final result
    const parts = fullText.split('---BODY---')
    const subject = parts[0]?.trim() || ''
    const bodyText = parts[1]?.trim() || ''

    console.log('[generateAIEmail] Final result:', { subject, bodyText })
    return { subject, bodyText }
  }

  throw new Error('No response body')
}

// ============================================================================
// Component: AI Assistant Menu
// ============================================================================

interface AIAssistantMenuProps {
  aiForm: ReturnType<typeof useForm<AIEmailFormData>>
  onGenerate: () => void
  isGenerating: boolean
}

/**
 * Comprehensive AI email generation form with all customization options
 * Allows users to specify recipient details, tone, style, and content preferences
 */
function AIAssistantMenu({ aiForm, onGenerate, isGenerating }: AIAssistantMenuProps) {
  return (
    <div className='flex flex-col gap-4 p-4 border rounded-lg bg-gray-50'>
      <h3 className='font-semibold text-sm'>AI Email Assistant</h3>

      <FormProvider {...aiForm}>
        <div className='grid grid-cols-2 gap-3'>
          {/* Email Category */}
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

          {/* Formality */}
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

          {/* Tone */}
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

          {/* Verboseness */}
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
          {/* Urgency Level */}
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
              name={'Desired Content'}
              placeholder={'Describe what you want the email to cover...'}
              field={field}
            />
          )}
        />
      </FormProvider>
    </div>
  )
}

// ============================================================================
// Component: Template Selector
// ============================================================================

interface TemplateSelectorProps {
  selectedTemplate: string
  onTemplateSelect: (value: string) => void
  onGenerate: () => void
  isGenerating: boolean
}

/**
 * Dropdown selector for choosing email templates
 * Includes generate button to apply AI-generated content
 */
function TemplateSelector({
  selectedTemplate,
  onTemplateSelect,
  onGenerate,
  isGenerating,
}: TemplateSelectorProps) {
  return (
    <div className='flex gap-2'>
      <Select value={selectedTemplate} onValueChange={onTemplateSelect}>
        <SelectTrigger className='w-[250px]'>
          <SelectValue placeholder='Select template' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='first-contact'>First contact</SelectItem>
          <SelectItem value='follow-up'>Follow-up</SelectItem>
          <SelectItem value='reply'>Reply</SelectItem>
        </SelectContent>
      </Select>
      <LoadingButton type='button' loading={isGenerating} onClick={onGenerate}>
        Generate
      </LoadingButton>
    </div>
  )
}

// ============================================================================
// Component: Email Form Fields
// ============================================================================

interface EmailFormFieldsProps {
  form: ReturnType<typeof useForm<FormData>>
}

/**
 * Form fields for email composition: To, Subject, and Body
 * Organized as a reusable component for better modularity
 */
function EmailFormFields({ form }: EmailFormFieldsProps) {
  return (
    <div className='flex-1 space-y-4'>
      {/* Recipient Email Field */}
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

      {/* Subject Line Field */}
      <FormField
        control={form.control}
        name='subject'
        render={({ field }) => (
          <InputItem name='Subject' field={field} placeholder='Email subject' />
        )}
      />

      {/* Email Body Field */}
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

// ============================================================================
// Main Component: Deal Email Dialog
// ============================================================================

/**
 * Main dialog component for composing and sending emails within a deal context
 *
 * Features:
 * - Pre-populated recipient from deal's customer
 * - Template selection for common email types
 * - AI-powered email generation
 * - Form validation and error handling
 * - CSRF protection
 * - Email audit trail in database
 */
export default function DealEmailDialog() {
  // Router hooks for navigation
  const navigate = useNavigate()
  const location = useLocation()

  // Local state management
  const [showAIMenu, setShowAIMenu] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Data from loader and action
  const { email, senderInfo, customerName } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()

  // Initialize email form with react-hook-form
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      to: email,
      subject: actionData?.receivedValues?.subject || '',
      text: actionData?.receivedValues?.text || '',
    },
  })

  // Initialize AI form with sender info from loader
  const aiForm = useForm<AIEmailFormData>({
    resolver: zodResolver(aiEmailSchema),
    defaultValues: {
      emailCategory: 'first-contact',
      formality: 'neutral',
      tone: 'friendly',
      verboseness: 'detailed',
      desiredContent: '',
      urgencyLevel: 'medium',
    },
  })

  // Form submission handler with full page reload
  const fullSubmit = useFullSubmit(form)

  /**
   * Handles dialog close - navigates back to project view
   */
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`../project${location.search}`)
    }
  }

  /**
   * Generates email content using AI based on form inputs
   * Updates email form fields with AI-generated subject and body
   * Shows error alert if generation fails
   */
  /**
   * Generates email content using AI based on form inputs
   * Updates email form fields with AI-generated subject and body
   * Shows error alert if generation fails
   */
  const handleGenerateWithAI = async () => {
    console.log('[handleGenerateWithAI] Starting generation...')

    const isValid = await aiForm.trigger()
    console.log('[handleGenerateWithAI] Form validation result:', isValid)

    if (!isValid) {
      console.log(
        '[handleGenerateWithAI] Validation failed, errors:',
        aiForm.formState.errors,
      )
      return
    }

    setIsGenerating(true)
    try {
      const aiFormData = aiForm.getValues()
      console.log('[handleGenerateWithAI] AI form data:', aiFormData)
      console.log('[handleGenerateWithAI] Sender info for request:', senderInfo)

      // Clear existing values before streaming
      form.setValue('subject', '')
      form.setValue('text', '')

      await generateAIEmail(
        aiFormData,
        senderInfo,
        customerName || 'Customer',
        subject => {
          // Stream subject in real-time
          form.setValue('subject', subject)
        },
        body => {
          // Stream body in real-time
          form.setValue('text', body)
        },
      )

      console.log('[handleGenerateWithAI] Successfully completed streaming')
    } catch (error) {
      console.error('[handleGenerateWithAI] Error:', error)
      alert(
        `Failed to generate AI email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setIsGenerating(false)
      console.log('[handleGenerateWithAI] Generation complete')
    }
  }

  /**
   * Toggles visibility of AI assistant menu
   */
  const handleToggleAIMenu = () => {
    setShowAIMenu(!showAIMenu)
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[600px] overflow-auto flex flex-col min-h-[400px] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={fullSubmit} className='flex-1 flex flex-col'>
            {/* CSRF Token for security */}
            <AuthenticityTokenInput />

            {/* Email form fields */}
            <EmailFormFields form={form} />

            {/* Action buttons above AI Assistant Menu */}
            <div className='mt-4 flex justify-between gap-2 w-full'>
              {/* AI Assistant toggle button */}
              <Button
                type='button'
                onClick={handleToggleAIMenu}
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

              {/* Submit button */}
              <Button type='submit' className='ml-auto'>
                Send Email
              </Button>
            </div>
          </form>
        </FormProvider>

        {/* AI Assistant Menu - shown when toggled, OUTSIDE the main form */}
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
