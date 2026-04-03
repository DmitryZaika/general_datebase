import { format } from 'date-fns'
import DOMPurify from 'isomorphic-dompurify'
import {
  FileText,
  ImageIcon,
  MoreVertical,
  Package,
  PaperclipIcon,
  Pencil,
  SendIcon,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AttachmentImagePicker } from '~/components/AttachmentImagePicker'
import { AiImproveButton } from '~/components/molecules/AiImproveButton'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
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
import { useIsMobile } from '~/hooks/use-mobile'
import { useToast } from '~/hooks/use-toast'
import { cn } from '~/lib/utils'
import { dateClass, fileSize } from '~/utils/constants'

export interface EmailChatAttachment {
  id: number
  email_id: number
  content_type: string
  content_subtype: string
  filename: string
  url: string
  signed_url?: string
}

export interface EmailChatMessage {
  id: number
  subject: string
  body: string
  signature?: string | null
  sent_at: string
  isFromCustomer: boolean
  read_at?: string
  employee_read_at?: string
  attachments?: EmailChatAttachment[]
}

interface EmailChatBaseProps {
  variant: 'admin' | 'employee'
  customerName: string
  messages: EmailChatMessage[]
  onClose: () => void
}

interface EmailChatEmployeeProps extends EmailChatBaseProps {
  variant: 'employee'
  dealId: number | null
  subject: string | null
  threadId: string
  currentUserSignature: string | null
  customerEmail: string
  companyId: number
}

export type EmailChatProps = EmailChatBaseProps | EmailChatEmployeeProps

function isEmployeeProps(p: EmailChatProps): p is EmailChatEmployeeProps {
  return p.variant === 'employee'
}

interface AIEmailResponse {
  subject?: string
  bodyText?: string
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
  dealId: number | null,
  subject: string | null,
  threadId: string,
  onStreamBody?: (text: string) => void,
): Promise<AIEmailResponse> {
  const variationToken = Math.random().toString(36).slice(2)
  const requestPayload = {
    emailCategory,
    dealId: dealId ?? undefined,
    variationToken,
    subject: subject ?? undefined,
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

function MessageDate({
  message,
  className,
}: {
  message: EmailChatMessage
  className?: string
}) {
  const date = new Date(message.sent_at)
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return <span className={`text-[10px] ${className ?? 'text-gray-500'}`}>{time}</span>
}

function getDisplayBody(body: string, signature: string | null | undefined): string {
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

function getInitials(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0][0]
    const b = parts[1][0]
    return ((a ?? '') + (b ?? '')).toUpperCase() || ''
  }
  return trimmed.slice(0, 1).toUpperCase()
}

export function EmailChat(props: EmailChatProps) {
  const { variant, customerName, messages, onClose } = props

  const [chatMessages, setChatMessages] = useState<EmailChatMessage[]>(messages)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [currentImages, setCurrentImages] = useState<
    { id: number; url: string; name: string; type: string; available: null }[]
  >([])
  const [currentImageId, setCurrentImageId] = useState<number | null>(null)

  const isEmployee = variant === 'employee'
  const employeeProps = isEmployeeProps(props) ? props : null
  const [showSelect, setShowSelect] = useState(false)
  const [selectActive, setSelectActive] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [messageText, setMessageText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showStonesPicker, setShowStonesPicker] = useState(false)
  const [showImagesPicker, setShowImagesPicker] = useState(false)
  const [showDocumentsPicker, setShowDocumentsPicker] = useState(false)
  const { toast } = useToast()
  const isMobile = useIsMobile()

  useEffect(() => {
    setChatMessages(messages)
  }, [messages])

  const scrollToBottom = () => {
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages.length])

  useEffect(() => {
    if (chatMessages.length === 0) return
    const t = setTimeout(scrollToBottom, 150)
    return () => clearTimeout(t)
  }, [messages])

  useEffect(() => {
    if (isEmployee && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [isEmployee, messageText])

  useEffect(() => {
    if (!isEmployee) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        setAttachments(prev => [...prev, ...files])
      }
    }
    document.addEventListener('paste', handlePaste, true)
    return () => document.removeEventListener('paste', handlePaste, true)
  }, [isEmployee])

  const lastMessageFromMe = [...chatMessages].reverse().find(m => !m.isFromCustomer)
  const lastReadMessageId = lastMessageFromMe?.read_at ? lastMessageFromMe.id : null

  function showDate(message: EmailChatMessage, index: number) {
    return (
      index === 0 ||
      new Date(chatMessages[index - 1].sent_at).toDateString() !==
        new Date(message.sent_at).toDateString()
    )
  }

  const addFiles = (newFiles: File[]) => {
    setAttachments(prev => [...prev, ...newFiles])
  }

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

  const handleTemplateSelect = (value: string) => {
    if (!employeeProps) return
    setSelectedTemplate(value)
    setSelectActive(false)
    handleGenerate(value)
  }

  const handleGenerate = async (templateOverride?: string) => {
    if (!employeeProps) return
    const template = templateOverride || selectedTemplate
    if (!template) return
    setIsGenerating(true)
    setMessageText('')
    try {
      await generateAIEmailForChat(
        template,
        employeeProps.dealId,
        employeeProps.subject,
        employeeProps.threadId,
        body => setMessageText(body),
      )
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
    if (!employeeProps) return
    const body = messageText.trim()
    if (!body && attachments.length === 0) return
    if (!employeeProps.customerEmail) {
      alert('Customer email is missing')
      return
    }
    const emailSubject = employeeProps.subject?.trim()
      ? employeeProps.subject
      : 'Follow up'

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append('to', employeeProps.customerEmail)
      formData.append('subject', emailSubject)
      formData.append('body', body)
      if (employeeProps.dealId) {
        formData.append('dealId', employeeProps.dealId.toString())
      }
      formData.append('threadId', employeeProps.threadId)

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
          const value = (payload as { error: string }).error
          if (typeof value === 'string') {
            errorText = value
          }
        }
        toast({
          title: 'Failure',
          description: errorText || 'Email failed to send',
          variant: 'destructive',
        })
        return
      }

      const localAttachments: EmailChatAttachment[] = attachments.map((file, i) => ({
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
          signature: employeeProps.currentUserSignature,
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isEmployee) setIsDragging(true)
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
    if (!isEmployee) return
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(files)])
    }
  }

  const dialogContentClass = `max-w-[100%] sm:max-w-[90%] sm:max-w-[900px] h-[95%] p-0 flex flex-col transition-colors ${isEmployee && isDragging ? 'bg-blue-50 ring-2 ring-blue-300 ring-dashed' : ''}`

  const rowClass =
    variant === 'admin'
      ? 'flex items-center gap-2 px-1 py-2 relative'
      : 'flex items-center gap-2 py-3 relative'

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className={dialogContentClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={isEmployee ? handleDrop : undefined}
        onOpenAutoFocus={
          isEmployee
            ? e => {
                if (!isMobile) {
                  e.preventDefault()
                  setTimeout(() => textareaRef.current?.focus(), 100)
                }
              }
            : undefined
        }
      >
        <DialogHeader className='p-2 border-b'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold'>
              {getInitials(customerName)}
            </div>
            <div>
              <DialogTitle className='text-lg font-semibold'>
                {customerName}
              </DialogTitle>
              {isEmployee && employeeProps?.customerEmail && (
                <p className='text-sm text-gray-500'>{employeeProps.customerEmail}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div ref={scrollContainerRef} className='flex-1 overflow-y-auto'>
          {chatMessages.map((message, index) => (
            <div key={message.id}>
              {showDate(message, index) && (
                <div className={dateClass}>
                  {format(new Date(message.sent_at), 'MMM d, yyyy')}
                </div>
              )}
              <div
                className={`${rowClass} ${message.isFromCustomer ? 'flex-row-reverse justify-end pl-2' : 'flex-row-reverse justify-start pr-2'}`}
              >
                <div
                  className={
                    message.isFromCustomer
                      ? 'bg-gray-200 text-black rounded-2xl px-2 py-2 max-w-[75%] break-words'
                      : 'bg-blue-500 text-white rounded-2xl px-2 py-2 max-w-[75%] relative pb-6 min-w-21.25 break-words'
                  }
                >
                  <div
                    className={cn(
                      'email-message-body break-words',
                      message.isFromCustomer
                        ? 'whitespace-pre-wrap [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5'
                        : 'whitespace-pre-wrap text-white [&_*]:!text-white [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5',
                    )}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Its safe
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        getDisplayBody(
                          message.body,
                          message.isFromCustomer ? null : message.signature,
                        ),
                        { ADD_TAGS: ['ul', 'ol', 'li'] },
                      ),
                    }}
                  />
                  {message.isFromCustomer ? null : (
                    <div className='absolute bottom-1 right-2 flex items-center gap-2'>
                      {message.signature && message.signature.trim() !== '' ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className='flex items-center gap-1 text-[9px] font-medium tracking-tight bg-white/15 text-white/80 border border-white/10 rounded-full px-2 py-0.5 select-none cursor-help hover:bg-white/25 hover:text-white transition-all duration-200'>
                                <Pencil size={16} className='w-2 h-2 opacity-70' />
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
                      ) : null}
                    </div>
                  )}
                  <MessageDate
                    message={message}
                    className={`text-black absolute -bottom-3.5 ${message.isFromCustomer ? 'left-2' : 'right-2'}`}
                  />
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
                                  className={`${fileSize} bg-zinc-600 rounded-md border border-zinc-800 flex flex-col items-center justify-center text-zinc-900 hover:bg-zinc-800 transition-colors p-2 shadow-md`}
                                >
                                  <FileText className='h-10 w-10 mb-2 text-blue-600' />
                                  <span className='text-[10px] font-semibold text-center break-all line-clamp-2 leading-tight'>
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
                  {!message.isFromCustomer && message.id === lastReadMessageId && (
                    <p className='text-xs text-gray-500'>Read</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className='p-2 border-t'>
          {isEmployee && attachments.length > 0 && (
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
          {isEmployee && employeeProps ? (
            <div className='flex flex-col md:flex-row flex-1 gap-2'>
              <div className='hidden md:flex items-end gap-2'>
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
                        <SelectItem value='feedback-request'>
                          Feedback Request
                        </SelectItem>
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
              </div>

              <div className='flex items-end flex-1 gap-1 max-h-30 relative'>
                <div className='md:hidden flex items-center self-center'>
                  <CustomDropdownMenu
                    align='start'
                    trigger={
                      <Button variant='ghost' size='icon' className='h-9 w-9'>
                        <MoreVertical className='h-5 w-5' />
                      </Button>
                    }
                    sections={[
                      {
                        title: 'Actions',
                        options: [
                          {
                            label: 'Upload from computer',
                            icon: <Upload className='w-4 h-4' />,
                            onClick: () => fileInputRef.current?.click(),
                          },
                          ...(employeeProps.companyId > 0
                            ? [
                                {
                                  label: 'From Stones',
                                  icon: <Package className='w-4 h-4' />,
                                  onClick: () => setShowStonesPicker(true),
                                },
                                {
                                  label: 'From Images',
                                  icon: <ImageIcon className='w-4 h-4' />,
                                  onClick: () => setShowImagesPicker(true),
                                },
                                {
                                  label: 'From Documents',
                                  icon: <FileText className='w-4 h-4' />,
                                  onClick: () => setShowDocumentsPicker(true),
                                },
                              ]
                            : []),
                          {
                            label: 'Generate with AI',
                            icon: <Sparkles className='w-4 h-4' />,
                            onClick: () => {
                              setShowSelect(true)
                              setSelectActive(true)
                            },
                          },
                          {
                            label: 'Improve message',
                            icon: <Pencil className='w-4 h-4' />,
                            onClick: () => {
                              const improveBtn = document.getElementById(
                                'mobile-improve-trigger',
                              )
                              if (improveBtn) improveBtn.click()
                            },
                          },
                        ],
                      },
                    ]}
                  />
                </div>

                <div className='hidden md:block'>
                  {employeeProps.companyId > 0 ? (
                    <CustomDropdownMenu
                      side='top'
                      trigger={
                        <Button type='button' size='icon' aria-label='Attachment'>
                          <PaperclipIcon className='h-5 w-5' />
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
                  ) : (
                    <Button
                      type='button'
                      size='icon'
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <PaperclipIcon className='h-5 w-5' />
                    </Button>
                  )}
                </div>

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
                  autoFocus={!isMobile}
                  className='flex-1 min-h-9.5 w-full max-h-30 rounded-sm border-none bg-transparent px-1 sm:px-4 py-2 text-base md:text-sm outline-none resize-none overflow-y-auto'
                />

                <div className='hidden'>
                  <AiImproveButton
                    id='mobile-improve-trigger'
                    getText={() => messageText}
                    setText={value => setMessageText(value)}
                    buttonSize='icon'
                    iconClassName='text-lg'
                  />
                </div>

                <div className='flex gap-1'>
                  <LoadingButton
                    loading={isSending}
                    type='button'
                    variant='default'
                    size='icon'
                    disabled={
                      isSending ||
                      (messageText.trim() === '' && attachments.length === 0)
                    }
                    onClick={handleSend}
                  >
                    <SendIcon className='h-2 w-2' />
                  </LoadingButton>
                </div>
              </div>
            </div>
          ) : (
            <div className='flex flex-col md:flex-row flex-1 gap-2' />
          )}
        </div>
        {isEmployee && employeeProps && employeeProps.companyId > 0 && (
          <>
            <AttachmentImagePicker
              type='stones'
              companyId={employeeProps.companyId}
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
              companyId={employeeProps.companyId}
              open={showImagesPicker}
              onClose={() => setShowImagesPicker(false)}
              onSelect={files => {
                addFiles(files)
                setShowImagesPicker(false)
              }}
            />
            <AttachmentImagePicker
              type='documents'
              companyId={employeeProps.companyId}
              open={showDocumentsPicker}
              onClose={() => setShowDocumentsPicker(false)}
              onSelect={files => {
                addFiles(files)
                setShowDocumentsPicker(false)
              }}
            />
          </>
        )}
      </DialogContent>
      <SuperCarousel
        type='email'
        currentId={currentImageId ?? undefined}
        setCurrentId={id => setCurrentImageId(id ?? null)}
        images={currentImages}
        userRole={variant}
        showInfo={false}
      />
    </Dialog>
  )
}
