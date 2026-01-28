import { format } from 'date-fns'
import DOMPurify from 'isomorphic-dompurify'
import { FileText, ImageIcon, PaperclipIcon, Pencil } from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useEffect, useRef, useState } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { AiImproveButton } from '~/components/molecules/AiImproveButton'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
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
import { db } from '~/db.server'
import { useToast } from '~/hooks/use-toast'
import { fileSize } from '~/utils/constants'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { presignIfS3Uri } from '~/utils/s3Presign.server'
import { getEmployeeUser, type User } from '~/utils/session.server'

interface Attachment {
  id: number
  email_id: number
  content_type: string
  content_subtype: string
  filename: string
  url: string
  signed_url?: string
}

interface Message {
  id: number
  subject: string
  body: string
  signature?: string | null
  sent_at: string
  isFromCustomer: boolean
  read_at?: string
  employee_read_at?: string
  attachments?: Attachment[]
}

interface AIEmailResponse {
  subject?: string
  bodyText?: string
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const [userSignatureRows] = await db.execute<RowDataPacket[]>(
    'SELECT email_signature FROM users WHERE id = ?',
    [user.id],
  )
  const currentUserSignature = userSignatureRows?.[0]?.email_signature || null
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }

  const dealId = parseInt(params.dealId, 10)
  const threadId = params.threadId
  if (!threadId) {
    posthogClient.captureException(new Error('Thread ID is missing'))
    throw new Error('Thread ID is missing')
  }

  const [customerRows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name, c.email
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ?`,
    [dealId],
  )

  const normalizeEmail = (email: string | null | undefined) =>
    email?.trim().toLowerCase() || ''
  const customerEmail = normalizeEmail(customerRows?.[0]?.email || '')

  if (customerEmail) {
    await db.execute(
      `
        UPDATE emails
        SET employee_read_at = NOW()
        WHERE deleted_at IS NULL
          AND thread_id = ?
          AND (deal_id = ? OR deal_id IS NULL)
          AND sender_email = ?
          AND employee_read_at IS NULL
      `,
      [threadId, dealId, customerEmail],
    )
  }

  let emailQuery = `SELECT e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, u.email_signature as signature, MAX(er.read_at) AS read_at
       FROM emails e
       LEFT JOIN email_reads er ON e.message_id = er.message_id
       LEFT JOIN users u ON u.id = e.sender_user_id
      WHERE e.deleted_at IS NULL AND e.thread_id = ? AND (e.deal_id = ? OR e.deal_id IS NULL)`
  const emailParams: (number | string)[] = [threadId, dealId]

  const attachmentsRaw = await selectMany<Attachment>(
    db,
    `SELECT id, email_id, content_type, content_subtype, filename, url
     FROM email_attachments
     WHERE email_id IN (
       SELECT id
       FROM emails
       WHERE deleted_at IS NULL AND thread_id = ?
     )`,
    [threadId],
  )
  const attachments = await Promise.all(
    attachmentsRaw.map(async attachment => {
      const signed = await presignIfS3Uri(attachment.url)
      if (signed === attachment.url) return attachment
      return { ...attachment, signed_url: signed }
    }),
  )

  emailQuery +=
    ' GROUP BY e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.employee_read_at, u.email_signature ORDER BY e.sent_at ASC'

  const [emailRows] = await db.execute<RowDataPacket[]>(emailQuery, emailParams)

  const messages: Message[] = (emailRows || []).map(row => {
    const senderEmail = normalizeEmail(row.sender_email)
    const isFromCustomer = senderEmail === customerEmail
    return {
      id: row.id,
      subject: row.subject,
      body: row.body,
      signature: row.signature,
      sent_at: row.sent_at,
      isFromCustomer,
      read_at: row.read_at,
      employee_read_at: row.employee_read_at,
      attachments: attachments.filter(attachment => attachment.email_id === row.id),
    }
  })

  return {
    customerName: customerRows?.[0]?.name || 'Customer',
    customerEmail,
    messages,
    dealId,
    subject: emailRows?.[0]?.subject || null,
    threadId,
    currentUserSignature,
  }
}

async function processStreamingResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onStreamBody?: (text: string) => void,
): Promise<AIEmailResponse> {
  const decoder = new TextDecoder()
  let fullText = ''
  let isInBody = false

  while (true) {
    const result = await reader.read()
    if (result.done) {
      break
    }
    const chunk = decoder.decode(result.value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6))
        if (data.error) {
          throw new Error(data.error)
        }
        if (data.content) {
          fullText += data.content

          if (fullText.includes('---BODY---')) {
            isInBody = true
            const parts = fullText.split('---BODY---')
            if (onStreamBody) {
              onStreamBody((parts[1] || '').trim())
            }
          } else if (isInBody) {
            const parts = fullText.split('---BODY---')
            if (onStreamBody) {
              onStreamBody((parts[1] || '').trim())
            }
          }
        }
      }
    }
  }

  const parts = fullText.split('---BODY---')
  return { subject: parts[0]?.trim() || '', bodyText: parts[1]?.trim() || '' }
}

async function generateAIEmailForChat(
  emailCategory: string,
  dealId: number,
  subject: string | null,
  threadId: string,
  onStreamBody?: (text: string) => void,
): Promise<AIEmailResponse> {
  const variationToken = Math.random().toString(36).slice(2)
  const requestPayload = {
    emailCategory,
    dealId,
    variationToken,
    subject: subject || undefined,
    threadId,
  }

  const response = await fetch('/api/aiRecommend/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to generate AI email: ${response.status} ${errorText}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  return processStreamingResponse(response.body.getReader(), onStreamBody)
}

function MessageDate({ message }: { message: Message }) {
  const date = new Date(message.sent_at)
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return <p className='text-xs text-gray-500 text-left'>{time}</p>
}

export default function EmailChatDialog() {
  const navigate = useNavigate()
  const [showSelect, setShowSelect] = useState(false)
  const [selectActive, setSelectActive] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const { toast } = useToast()
  const {
    customerName,
    customerEmail,
    messages,
    dealId,
    subject,
    threadId,
    currentUserSignature,
  } = useLoaderData<typeof loader>()
  const [chatMessages, setChatMessages] = useState<Message[]>(messages)
  const [messageText, setMessageText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentImages, setCurrentImages] = useState<
    { id: number; url: string; name: string; type: string; available: null }[]
  >([])
  const [currentImageId, setCurrentImageId] = useState<number | null>(null)
  const location = useLocation()
  const removeAttachment = (file: File) => {
    setAttachments(prev => prev.filter(f => f !== file))
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

  const getDisplayBody = (body: string, signature: string | null | undefined) => {
    const b = (body || '').trimEnd()
    const s = (signature || '').trim()
    if (!s) return b
    const idx = b.lastIndexOf(s)
    if (idx === -1) return b
    if (idx < b.length - s.length - 20) return b
    const without = b.slice(0, idx).trimEnd()
    const withoutDash = without.endsWith('—') ? without.slice(0, -1).trimEnd() : without
    return withoutDash.trimEnd()
  }

  useEffect(() => {
    setChatMessages(messages)
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages.length])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [messageText])

  const handleClose = () => {
    navigate(`/employee/deals/edit/${dealId}/history${location.search}`)
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const lastMessageFromMe = [...chatMessages].reverse().find(m => !m.isFromCustomer)
  const lastReadMessageId = lastMessageFromMe?.read_at ? lastMessageFromMe.id : null

  const handleTemplateSelect = (value: string) => {
    setSelectedTemplate(value)
    setSelectActive(false)
    handleGenerate(value)
  }

  const handleGenerate = async (templateOverride?: string) => {
    const template = templateOverride || selectedTemplate
    if (!template) {
      return
    }
    setIsGenerating(true)
    setMessageText('')
    try {
      await generateAIEmailForChat(template, dealId, subject, threadId, body => {
        setMessageText(body)
      })
    } catch (error) {
      if (error instanceof Error) {
        alert(`Failed to generate AI email: ${error.message}`)
      } else {
        alert('Failed to generate AI email')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSend = async () => {
    const body = messageText.trim()
    if (!body && attachments.length === 0) return
    if (!customerEmail) {
      alert('Customer email is missing')
      return
    }
    const emailSubject = subject?.trim() ? subject : 'Follow up'

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append('to', customerEmail)
      formData.append('subject', emailSubject)
      formData.append('body', body)
      formData.append('dealId', dealId.toString())
      formData.append('threadId', threadId)

      attachments.forEach(file => {
        formData.append('attachments', file)
      })

      const response = await fetch('/api/employee/sendEmail', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorText = ''
        const payload: unknown = await response.json()
        if (payload && typeof payload === 'object' && 'error' in payload) {
          const value = payload.error
          if (typeof value === 'string') {
            errorText = value
          }
        }
        toast({
          title: 'Failure',
          description: errorText || 'Email failed to send',
          variant: 'destructive',
        })
      }

      const localAttachments: Attachment[] = attachments.map((file, i) => ({
        id: -Date.now() - i,
        email_id: -1,
        content_type: file.type.split('/')[0] || 'application',
        content_subtype: file.type.split('/')[1] || 'octet-stream',
        filename: file.name,
        url: URL.createObjectURL(file),
      }))

      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          subject: emailSubject,
          body,
          signature: currentUserSignature,
          sent_at: new Date().toISOString(),
          isFromCustomer: false,
          attachments: localAttachments,
        },
      ])
      setMessageText('')
      setAttachments([])
      toast({ title: 'Success', description: 'Email sent!', variant: 'success' })
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert('Email failed to send')
      }
    } finally {
      setIsSending(false)
    }
  }

  function showDate(message: Message, index: number) {
    return (
      index === 0 ||
      new Date(chatMessages[index - 1].sent_at).toDateString() !==
        new Date(message.sent_at).toDateString()
    )
  }

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[60%] h-[90%] p-0 flex flex-col'>
        <DialogHeader className='p-4 border-b'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold'>
              {getInitials(customerName)}
            </div>
            <div>
              <DialogTitle className='text-lg font-semibold'>
                {customerName}
              </DialogTitle>
              <p className='text-sm text-gray-500'>Email: {customerEmail}</p>
              <p className='text-sm text-gray-500'>Subject: {subject}</p>
            </div>
          </div>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto p-4 space-y-4'>
          {chatMessages.map((message, index) => (
            <div key={message.id}>
              {showDate(message, index) && (
                <div className='text-center text-xs text-gray-500 my-4'>
                  {format(new Date(message.sent_at), 'MMM d, yyyy')}
                </div>
              )}
              <div
                className={`flex items-center gap-2 ${message.isFromCustomer ? 'flex-row-reverse justify-end' : 'flex-row-reverse justify-start'}`}
              >
                {!message.isFromCustomer && <MessageDate message={message} />}
                <div
                  className={
                    message.isFromCustomer
                      ? 'bg-gray-200 text-black rounded-2xl px-2 py-2 max-w-[75%]'
                      : `bg-blue-500 text-white rounded-2xl px-2 py-2 max-w-[75%] relative ${
                          message.signature && message.signature.trim() !== ''
                            ? 'pb-6 min-w-21.25'
                            : ''
                        }`
                  }
                >
                  <div
                    className='whitespace-pre-wrap'
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Its safe
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        getDisplayBody(
                          message.body,
                          message.isFromCustomer ? null : message.signature,
                        ),
                      ),
                    }}
                  />
                  {!message.isFromCustomer &&
                  message.signature &&
                  message.signature.trim() !== '' ? (
                    <div className='absolute bottom-1 right-2'>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className='flex items-center gap-1 text-[9px] font-medium tracking-tight bg-white/15 text-white/80 border border-white/10 rounded-full px-2 py-0.5 select-none cursor-help hover:bg-white/25 hover:text-white transition-all duration-200'>
                              <Pencil className='w-2 h-2 opacity-70' />
                              Signature
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side='top'
                            className='max-w-90 whitespace-pre-wrap select-none bg-zinc-900 text-zinc-100 border-zinc-800 shadow-xl'
                          >
                            {message.signature}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ) : null}
                  {message.attachments && message.attachments.length > 0 ? (
                    <div className='mt-3 flex flex-wrap gap-3'>
                      {message.attachments.map(attachment => {
                        const mime = `${attachment.content_type}/${attachment.content_subtype}`
                        const label = attachment.filename || mime
                        const contentType = attachment.content_type.toLowerCase()
                        const isImage =
                          contentType === 'image' || contentType.startsWith('image/')
                        const isPdf =
                          (contentType === 'application' &&
                            attachment.content_subtype.toLowerCase() === 'pdf') ||
                          mime.toLowerCase().includes('pdf')
                        const href = attachment.signed_url || attachment.url
                        const linkClass = message.isFromCustomer
                          ? 'text-blue-700 underline'
                          : 'text-white underline'

                        return (
                          <div key={attachment.id} className='space-y-2 max-w-[140px]'>
                            {isPdf && href ? (
                              <a
                                href={href}
                                target='_blank'
                                rel='noreferrer'
                                className='block'
                                download
                              >
                                <div
                                  className={`${fileSize} bg-white rounded-md border border-gray-300 flex flex-col items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors p-2 shadow-sm`}
                                >
                                  <FileText className='h-10 w-10 mb-2 text-gray-400' />
                                  <span className='text-[10px] text-center break-all line-clamp-2 leading-tight'>
                                    {label}
                                  </span>
                                </div>
                              </a>
                            ) : !isImage && href ? (
                              <a
                                href={href}
                                target='_blank'
                                rel='noreferrer'
                                className={linkClass}
                                download
                              >
                                <span className='inline-flex items-center gap-1'>
                                  <FileText className='h-4 w-4' />
                                  <span>{label}</span>
                                </span>
                              </a>
                            ) : null}
                            {isImage && href ? (
                              <button
                                type='button'
                                className='block cursor-pointer'
                                onClick={() => {
                                  const imgs =
                                    message.attachments
                                      ?.filter(
                                        a =>
                                          a.content_type.toLowerCase() === 'image' &&
                                          (a.signed_url || a.url),
                                      )
                                      .map(img => ({
                                        id: img.id,
                                        url: img.signed_url || img.url,
                                        name:
                                          img.filename ||
                                          `${img.content_type}/${img.content_subtype}`,
                                        type: 'email',
                                        available: null,
                                      })) || []
                                  setCurrentImages(imgs)
                                  setCurrentImageId(attachment.id)
                                }}
                              >
                                <img
                                  src={href}
                                  alt={label}
                                  className={`${fileSize} object-cover rounded-md border border-black/10`}
                                />
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
                <div className='flex items-center gap-2'>
                  {message.isFromCustomer && <MessageDate message={message} />}
                  {!message.isFromCustomer && message.id === lastReadMessageId && (
                    <p className='text-xs text-gray-500'>Read</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className='p-4 border-t'>
          {attachments.length > 0 && (
            <div className='mb-2 flex flex-wrap gap-2'>
              {attachments.map(file => {
                const isTruncated = file.name.length > 15
                const displayName = formatFileName(file.name)
                const badge = (
                  <Badge
                    key={`${file.name}-${file.size}`}
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
                  <TooltipProvider key={`${file.name}-${file.size}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>{badge}</TooltipTrigger>
                      <TooltipContent side='top'>{file.name}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          )}
          <div className='flex items-end gap-2'>
            {showSelect ? (
              <div className='flex gap-2 items-end'>
                <Select
                  open={selectActive}
                  onOpenChange={setSelectActive}
                  value={selectedTemplate}
                  onValueChange={value => handleTemplateSelect(value)}
                >
                  <SelectTrigger className='w-37.5'>
                    <SelectValue placeholder='Select template' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='follow-up'>Follow-up</SelectItem>
                    <SelectItem value='reply'>Reply</SelectItem>
                    <SelectItem value='thank-you'>Thank You</SelectItem>
                    <SelectItem value='feedback-request'>Feedback Request</SelectItem>
                    <SelectItem value='referral'>Referral</SelectItem>
                  </SelectContent>
                </Select>
                <LoadingButton
                  loading={isGenerating}
                  type='button'
                  onClick={() => handleGenerate()}
                >
                  Generate
                </LoadingButton>
              </div>
            ) : (
              <Button
                type='button'
                onClick={() => {
                  setShowSelect(true)
                  setSelectActive(true)
                }}
              >
                Generate with AI
              </Button>
            )}
            <AiImproveButton
              getText={() => messageText}
              setText={value => setMessageText(value)}
              buttonSize='icon'
              iconClassName='text-lg'
            />
            <Button
              type='button'
              size='icon'
              onClick={() => fileInputRef.current?.click()}
            >
              <PaperclipIcon className='h-5 w-5' />
            </Button>
            <input
              ref={fileInputRef}
              type='file'
              className='hidden'
              multiple
              onChange={e => {
                const files = e.currentTarget.files
                if (files && files.length > 0) {
                  setAttachments(prev => [...prev, ...Array.from(files)])
                }
                e.currentTarget.value = ''
              }}
            />
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={e => {
                setMessageText(e.target.value)
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto'
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
                }
              }}
              placeholder='Send a message'
              rows={1}
              className='flex-1 min-h-9.5 max-h-40 rounded-sm border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none resize-none overflow-y-auto'
            />
            <div className='flex items-center gap-1 mb-1'>
              <LoadingButton
                loading={isSending}
                type='button'
                variant='ghost'
                size='icon'
                className='text-zinc-500'
                disabled={
                  isSending || (messageText.trim() === '' && attachments.length === 0)
                }
                onClick={handleSend}
              >
                <span className='text-xl'>➤</span>
              </LoadingButton>
            </div>
          </div>
        </div>
      </DialogContent>
      <SuperCarousel
        type='email'
        currentId={currentImageId ?? undefined}
        setCurrentId={id => setCurrentImageId(id ?? null)}
        images={currentImages}
        userRole='employee'
        showInfo={false}
      />
    </Dialog>
  )
}
