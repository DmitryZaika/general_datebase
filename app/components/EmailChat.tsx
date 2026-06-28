import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import DOMPurify from 'isomorphic-dompurify'
import {
  Check,
  ExternalLink,
  FileText,
  ImageIcon,
  MoreVertical,
  Package,
  PaperclipIcon,
  Pencil,
  Plus,
  Search,
  SendIcon,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useNavigation } from 'react-router'
import { AttachmentImagePicker } from '~/components/AttachmentImagePicker'
import { CopyText } from '~/components/atoms/CopyText'
import { AiImproveButton } from '~/components/molecules/AiImproveButton'
import { AttachmentImageEditorDialog } from '~/components/molecules/AttachmentImageEditorDialog'
import {
  DealChoiceList,
  dealOptionName,
  parseDealOptionsFromPayload,
  readPayloadError,
} from '~/components/molecules/DealChoiceList'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
import { EmailTemplatePickerPopover } from '~/components/molecules/EmailTemplatePickerPopover'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
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
import { useToast } from '~/hooks/use-toast'
import { cn } from '~/lib/utils'
import type { Nullable } from '~/types/utils'
import { applyEmailTemplateContent } from '~/utils/applyEmailTemplate.client'
import { compressImageFiles } from '~/utils/compressImage.client'
import { dateClass, fileSize } from '~/utils/constants'
import type { CustomerDealOption } from '~/utils/customerDeals.server'
import {
  buildEmailCarouselImages,
  resolveEmailAttachmentDisplayUrl,
} from '~/utils/emailAttachmentPreview.client'
import {
  getEmailAttachmentImageSrc,
  isEmailAttachmentImage,
  isHeicEmailAttachment,
} from '~/utils/emailAttachmentUi'
import {
  type EmailTemplate,
  fetchAllTemplates,
  filterTemplates,
  getTemplatePreview,
  TEMPLATE_STALE_TIME,
  templateQueryKey,
} from '~/utils/emailTemplates'
import {
  getUnfilledCustomVariables,
  hasAnyVariables,
} from '~/utils/emailTemplateVariables'
import {
  filterVisibleEmailAttachments,
  isGmailReactionEmailBody,
  stripGmailReactionNoiseFromBody,
} from '~/utils/gmailReactionEmail'
import { htmlToPlainText } from '~/utils/stringHelpers'

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

interface EmailChatDealNav {
  companyId: number
  customerEmail: string
  pathPrefix: 'employee' | 'admin'
  threadDealId: number | null
}

interface EmailChatBaseProps {
  variant: 'admin' | 'employee'
  customerName: string
  customerId: number | null
  messages: EmailChatMessage[]
  onClose: () => void
  scrollToMessageId?: number | null
  dealNav?: EmailChatDealNav
  embedded?: boolean
  userId: number
  readOnly?: boolean
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
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
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

const EMAIL_HTML_TAG_REGEX = /<\/?[a-z][\s\S]*>/i
const EMAIL_MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^)]+)\)/gi
const EMAIL_URL_REGEX = /\bhttps?:\/\/[^\s<>"')]+[^\s<>"').,;:]/gi
const EMAIL_GREETING_REGEX = /\b(Hi|Hello|Dear|This|Thank|Location:)\b/i
const EMAIL_EXISTING_ANCHOR_REGEX = /<a\b[\s\S]*?<\/a>/gi
const EMAIL_INLINE_URL_BOUNDARY_REGEX =
  /(^|[\s>(])((?:https?:\/\/)[^\s<>"']+[^\s<>"').,;:])/gim

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function emailAnchor(url: string, label: string): string {
  const href = escapeAttribute(url)
  return `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`
}

function normalizeEmailUrl(url: string): string {
  return url.replace(/&amp;/gi, '&').replace(/&#38;/gi, '&')
}

function formatEmailInline(value: string): string {
  const replacements: string[] = []
  const withMarkdownLinks = value.replace(
    EMAIL_MARKDOWN_LINK_REGEX,
    (_match, label, url) => {
      const index = replacements.length
      const normalizedUrl = normalizeEmailUrl(String(url))
      replacements.push(emailAnchor(normalizedUrl, escapeHtml(String(label))))
      return `__EMAIL_LINK_${index}__`
    },
  )
  const linked = escapeHtml(withMarkdownLinks)
    .replace(EMAIL_URL_REGEX, url => {
      const normalizedUrl = normalizeEmailUrl(url)
      return emailAnchor(normalizedUrl, escapeHtml(normalizedUrl))
    })
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')

  return replacements.reduce(
    (html, replacement, index) => html.replace(`__EMAIL_LINK_${index}__`, replacement),
    linked,
  )
}

function stripEmailCssNoise(value: string): string {
  const withoutStyleTags = value.replace(/<style[\s\S]*?<\/style>/gi, '')
  const firstGreeting = withoutStyleTags.search(EMAIL_GREETING_REGEX)
  if (firstGreeting <= 0) return withoutStyleTags

  const prefix = withoutStyleTags.slice(0, firstGreeting)
  if (!/(@media|!important|a:link|a:visited|\{|\})/i.test(prefix)) {
    return withoutStyleTags
  }

  return withoutStyleTags.slice(firstGreeting).trimStart()
}

function plainEmailToHtml(value: string): string {
  const lines = stripEmailCssNoise(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let pendingListItem: string[] | null = null

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(`<p>${paragraph.map(formatEmailInline).join('<br>')}</p>`)
    paragraph = []
  }

  const flushList = () => {
    if (list.length === 0) return
    blocks.push(
      `<ul>${list.map(item => `<li>${formatEmailInline(item)}</li>`).join('')}</ul>`,
    )
    list = []
  }

  const flushPendingListItem = () => {
    if (pendingListItem === null) return
    const item = pendingListItem.join(' ').replace(/\s+/g, ' ').trim()
    if (item) list.push(item)
    pendingListItem = null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '-') {
      flushParagraph()
      flushPendingListItem()
      pendingListItem = []
      continue
    }
    if (!trimmed) {
      flushParagraph()
      flushPendingListItem()
      flushList()
      continue
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      flushPendingListItem()
      list.push(bullet[1])
      continue
    }
    if (pendingListItem !== null) {
      pendingListItem.push(trimmed)
      continue
    }
    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushPendingListItem()
  flushList()
  return blocks.join('')
}

function sanitizeEmailBody(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ADD_TAGS: ['ul', 'ol', 'li', 'a', 'strong', 'em', 'p', 'br'],
    ADD_ATTR: ['href', 'target', 'rel'],
  })
  const withTargets = sanitized.replace(
    /<a\s+(?![^>]*\btarget=)/gi,
    '<a target="_blank" rel="noreferrer" ',
  )
  const anchors: string[] = []
  const withoutAnchors = withTargets.replace(EMAIL_EXISTING_ANCHOR_REGEX, match => {
    const marker = `__EMAIL_ANCHOR_${anchors.length}__`
    anchors.push(match)
    return marker
  })
  const linkified = withoutAnchors.replace(
    EMAIL_INLINE_URL_BOUNDARY_REGEX,
    (_match, prefix: string, url: string) => {
      const normalizedUrl = url.replace(/&amp;/gi, '&')
      return `${prefix}<a href="${escapeAttribute(normalizedUrl)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>`
    },
  )
  return anchors.reduce(
    (htmlOutput, anchor, index) =>
      htmlOutput.replace(`__EMAIL_ANCHOR_${index}__`, anchor),
    linkified,
  )
}

function formatEmailBody(body: string, signature: string | null | undefined): string {
  let displayBody = stripEmailCssNoise(getDisplayBody(body, signature))
  if (isGmailReactionEmailBody(displayBody)) {
    displayBody = stripGmailReactionNoiseFromBody(displayBody)
  }
  const html = EMAIL_HTML_TAG_REGEX.test(displayBody)
    ? displayBody
    : plainEmailToHtml(displayBody)
  return sanitizeEmailBody(html)
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

function MobileTemplatePicker({
  open,
  onOpenChange,
  templates,
  isLoading,
  searchQuery,
  onSearchChange,
  onSelect,
  activeTemplateId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: EmailTemplate[]
  isLoading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelect: (template: EmailTemplate) => void
  activeTemplateId: Nullable<number>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md rounded-xl'>
        <DialogHeader>
          <DialogTitle>Choose Template</DialogTitle>
        </DialogHeader>
        <div className='relative'>
          <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
          <Input
            placeholder='Search templates...'
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className='pl-8 text-sm'
          />
        </div>
        <div className='max-h-64 overflow-y-auto -mx-2'>
          {isLoading && (
            <div className='flex items-center justify-center py-4'>
              <div className='animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent' />
            </div>
          )}
          {!isLoading && templates.length === 0 && (
            <div className='px-3 py-4 text-sm text-gray-500 text-center'>
              {searchQuery.length > 0 ? 'No templates found' : 'No templates available'}
            </div>
          )}
          {!isLoading &&
            templates.map(template => {
              const isActive = template.id === activeTemplateId
              return (
                <button
                  key={template.id}
                  type='button'
                  className={`w-full px-3 py-2 cursor-pointer text-left transition-colors ${
                    isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onSelect(template)}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <div className='font-medium text-sm truncate'>
                      {template.template_name}
                    </div>
                    {isActive && (
                      <Check className='h-3.5 w-3.5 shrink-0 text-blue-600' />
                    )}
                  </div>
                  <div className='text-xs text-gray-500 truncate'>
                    {getTemplatePreview(template.template_body, 50)}...
                  </div>
                </button>
              )
            })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmailChatAttachmentImage({
  attachment,
  label,
  className,
  onOpen,
}: {
  attachment: EmailChatAttachment
  label: string
  className: string
  onOpen: () => void
}) {
  const needsPreview = isHeicEmailAttachment(attachment)
  const [displayUrl, setDisplayUrl] = useState<string | null>(
    needsPreview ? null : (getEmailAttachmentImageSrc(attachment) ?? null),
  )
  const [loading, setLoading] = useState(needsPreview)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const url = await resolveEmailAttachmentDisplayUrl(attachment)
      if (!cancelled) {
        setDisplayUrl(url)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    attachment.id,
    attachment.url,
    attachment.signed_url,
    attachment.filename,
    attachment.content_type,
    attachment.content_subtype,
  ])

  if (loading) {
    return (
      <div
        className={`${className} bg-slate-100 animate-pulse`}
        aria-label='Loading image'
      />
    )
  }

  if (!displayUrl) {
    return (
      <button
        type='button'
        className={`${className} flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-600 p-2`}
        onClick={onOpen}
      >
        <ImageIcon className='h-6 w-6' />
        <span className='text-[10px] line-clamp-2 break-all text-center'>{label}</span>
      </button>
    )
  }

  return (
    <button type='button' className='block cursor-pointer' onClick={onOpen}>
      <img src={displayUrl} alt={label} className={className} />
    </button>
  )
}

export function EmailChat(props: EmailChatProps) {
  const {
    variant,
    customerName,
    customerId,
    messages,
    onClose,
    scrollToMessageId,
    dealNav,
    userId,
    embedded = false,
    readOnly = false,
  } = props
  const navigate = useNavigate()
  const navigation = useNavigation()
  const canCompose = isEmployeeProps(props) && !readOnly

  const [chatMessages, setChatMessages] = useState<EmailChatMessage[]>(messages)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const targetMessageId = scrollToMessageId ?? null
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null)
  const initialScrollHandled = useRef(false)
  const [currentImages, setCurrentImages] = useState<
    { id: number; url: string; name: string; type: string; available: null }[]
  >([])
  const [currentImageId, setCurrentImageId] = useState<Nullable<number>>(null)

  const isEmployee = variant === 'employee'
  const employeeProps = isEmployeeProps(props) ? props : null
  const [showSelect, setShowSelect] = useState(false)
  const [selectActive, setSelectActive] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [messageText, setMessageText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [editingAttachment, setEditingAttachment] = useState<File | null>(null)
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>(
    {},
  )
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showStonesPicker, setShowStonesPicker] = useState(false)
  const [showImagesPicker, setShowImagesPicker] = useState(false)
  const [showDocumentsPicker, setShowDocumentsPicker] = useState(false)
  const [showMobileTemplatePicker, setShowMobileTemplatePicker] = useState(false)
  const [mobileTemplateSearch, setMobileTemplateSearch] = useState('')
  const [pendingTemplate, setPendingTemplate] = useState<Nullable<EmailTemplate>>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<Nullable<number>>(null)
  const [pendingDealAttachment, setPendingDealAttachment] =
    useState<Nullable<EmailChatAttachment>>(null)
  const [attachmentDealChoices, setAttachmentDealChoices] = useState<
    CustomerDealOption[]
  >([])
  const [isAddingAttachmentToDeal, setIsAddingAttachmentToDeal] = useState(false)
  const [dealNavPickerOpen, setDealNavPickerOpen] = useState(false)
  const [dealNavChoices, setDealNavChoices] = useState<CustomerDealOption[]>([])
  const [dealNavLoading, setDealNavLoading] = useState(false)
  const [dealNavRouteActive, setDealNavRouteActive] = useState(false)
  const { toast } = useToast()

  const focusComposer = useCallback(() => {
    if (targetMessageId !== null) return
    textareaRef.current?.focus()
  }, [targetMessageId])

  useLayoutEffect(() => {
    if (!canCompose || targetMessageId !== null) return
    focusComposer()
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const timerA = setTimeout(focusComposer, 100)
      const timerB = setTimeout(focusComposer, 350)
      return () => {
        clearTimeout(timerA)
        clearTimeout(timerB)
      }
    }
  }, [canCompose, targetMessageId, focusComposer])

  const { data: mobileTemplates = [], isLoading: mobileTemplatesLoading } = useQuery({
    queryKey: templateQueryKey(employeeProps?.companyId ?? 0),
    queryFn: () => fetchAllTemplates(employeeProps?.companyId ?? 0),
    enabled: showMobileTemplatePicker && !!employeeProps?.companyId,
    staleTime: TEMPLATE_STALE_TIME,
  })

  const filteredMobileTemplates = useMemo(
    () => filterTemplates(mobileTemplates, mobileTemplateSearch),
    [mobileTemplates, mobileTemplateSearch],
  )

  useEffect(() => {
    setChatMessages(messages)
  }, [messages])

  useEffect(() => {
    if (navigation.state === 'idle') {
      setDealNavRouteActive(false)
    }
  }, [navigation.state])

  const scrollToBottom = () => {
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  useEffect(() => {
    if (targetMessageId !== null && !initialScrollHandled.current) return
    scrollToBottom()
  }, [chatMessages.length])

  useEffect(() => {
    if (chatMessages.length === 0) return
    if (targetMessageId !== null && !initialScrollHandled.current) return
    const t = setTimeout(scrollToBottom, 150)
    return () => clearTimeout(t)
  }, [messages])

  useEffect(() => {
    if (targetMessageId === null) return
    if (initialScrollHandled.current) return
    if (chatMessages.length === 0) return

    let highlightClearTimeout: ReturnType<typeof setTimeout> | undefined
    const t = setTimeout(() => {
      const el = messageRefs.current.get(targetMessageId)
      if (!el) {
        initialScrollHandled.current = true
        scrollToBottom()
        return
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedMessageId(targetMessageId)
      initialScrollHandled.current = true
      highlightClearTimeout = setTimeout(() => setHighlightedMessageId(null), 1500)
    }, 250)
    return () => {
      clearTimeout(t)
      if (highlightClearTimeout !== undefined) clearTimeout(highlightClearTimeout)
    }
  }, [targetMessageId, chatMessages.length])

  useEffect(() => {
    if (isEmployee && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [isEmployee, messageText])

  useEffect(() => {
    if (!canCompose) return
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
        void appendAttachments(files)
      }
    }
    document.addEventListener('paste', handlePaste, true)
    return () => document.removeEventListener('paste', handlePaste, true)
  }, [isEmployee])

  const lastMessageFromMe = [...chatMessages].reverse().find(m => !m.isFromCustomer)
  const lastReadMessageId = lastMessageFromMe?.read_at ? lastMessageFromMe.id : null

  function getAttachmentPreviewKey(file: File) {
    return `${file.name}-${file.size}-${file.lastModified}`
  }

  function showDate(message: EmailChatMessage, index: number) {
    return (
      index === 0 ||
      new Date(chatMessages[index - 1].sent_at).toDateString() !==
        new Date(message.sent_at).toDateString()
    )
  }

  const removeAttachment = (file: File) => {
    const previewKey = getAttachmentPreviewKey(file)
    const previewUrl = attachmentPreviews[previewKey]
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setAttachmentPreviews(prev => {
        const next = { ...prev }
        delete next[previewKey]
        return next
      })
    }
    setAttachments(prev => prev.filter(f => f !== file))
    setEditingAttachment(current => (current === file ? null : current))
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
    return <FileText className='h-8 w-8' />
  }

  async function appendAttachments(newFiles: File[]) {
    const processed = await compressImageFiles(newFiles)
    setAttachments(prev => [...prev, ...processed])
    setAttachmentPreviews(prev => {
      const next = { ...prev }
      for (const file of processed) {
        const key = getAttachmentPreviewKey(file)
        const isImageFile = file.type.toLowerCase().startsWith('image/')
        if (isImageFile && !next[key]) {
          next[key] = URL.createObjectURL(file)
        }
      }
      return next
    })
  }

  function clearAttachmentPreviews() {
    const urls = Object.values(attachmentPreviews)
    for (const url of urls) {
      URL.revokeObjectURL(url)
    }
    setAttachmentPreviews({})
  }

  function replaceAttachment(originalFile: File, editedFile: File) {
    const originalKey = getAttachmentPreviewKey(originalFile)
    const originalPreviewUrl = attachmentPreviews[originalKey]
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    const editedKey = getAttachmentPreviewKey(editedFile)
    const editedPreviewUrl = URL.createObjectURL(editedFile)
    setAttachmentPreviews(prev => {
      const next = { ...prev }
      delete next[originalKey]
      next[editedKey] = editedPreviewUrl
      return next
    })
    setAttachments(prev =>
      prev.map(file => (file === originalFile ? editedFile : file)),
    )
    setEditingAttachment(null)
  }

  function openAttachment(file: File) {
    const fileUrl = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = fileUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(fileUrl), 30_000)
  }

  const handleTemplateSelect = (value: string) => {
    if (!employeeProps) return
    setSelectedTemplate(value)
    setSelectActive(false)
    handleGenerate(value)
  }

  const applyEmailTemplate = async (template: EmailTemplate) => {
    if (!employeeProps) return
    const applied = await applyEmailTemplateContent(
      userId,
      employeeProps.dealId,
      customerId,
      template,
    )
    const plainText = htmlToPlainText(applied.body)
    setMessageText(plainText)
    setActiveTemplateId(template.id)
    clearAttachmentPreviews()
    setAttachments(applied.attachments)
    setAttachmentPreviews(applied.previews)

    const customVars = getUnfilledCustomVariables(plainText)
    if (customVars.length > 0) {
      toast({
        title: 'Custom variables detected',
        description: `Please fill in: ${customVars.map(v => `{{${v}}}`).join(', ')}`,
      })
    }
  }

  const handleEmailTemplateSelect = (template: EmailTemplate): boolean => {
    if (!employeeProps) return false
    if (messageText.trim() !== '') {
      setPendingTemplate(template)
      return false
    }
    void applyEmailTemplate(template)
    return true
  }

  const handleConfirmTemplateReplace = () => {
    if (!pendingTemplate) return
    void applyEmailTemplate(pendingTemplate)
    setPendingTemplate(null)
    setShowMobileTemplatePicker(false)
    setMobileTemplateSearch('')
  }

  const closeAttachmentDealDialog = () => {
    setPendingDealAttachment(null)
    setAttachmentDealChoices([])
  }

  const closeDealNavPicker = () => {
    setDealNavPickerOpen(false)
    setDealNavChoices([])
  }

  const goToDeal = (dealId: number): boolean => {
    if (!dealNav) return false
    setDealNavLoading(true)
    setDealNavRouteActive(true)
    navigate(`/${dealNav.pathPrefix}/deals/edit/${dealId}/project`)
    return true
  }

  const dealNavButtonLoading =
    dealNavLoading || (navigation.state !== 'idle' && dealNavRouteActive)

  const handleDealNavClick = async () => {
    if (!dealNav) return

    const canLookupCustomer =
      dealNav.customerEmail.trim().length > 0 || customerName.trim().length > 0

    if (!canLookupCustomer) {
      if (dealNav.threadDealId !== null) {
        goToDeal(dealNav.threadDealId)
        return
      }
      toast({
        title: 'Cannot open deal',
        description: 'No customer email or name to look up deals.',
        variant: 'destructive',
      })
      return
    }

    setDealNavLoading(true)
    let navigatingToDeal = false
    try {
      const params = new URLSearchParams()
      if (dealNav.customerEmail.trim()) {
        params.set('customerEmail', dealNav.customerEmail.trim())
      }
      if (customerName.trim()) {
        params.set('customerName', customerName.trim())
      }
      const response = await fetch(`/api/customer-deals?${params}`)
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const description = readPayloadError(payload) ?? 'Could not load deals'
        toast({ title: 'Failure', description, variant: 'destructive' })
        return
      }

      const deals = parseDealOptionsFromPayload(payload)

      if (deals.length === 0) {
        if (dealNav.threadDealId !== null) {
          navigatingToDeal = goToDeal(dealNav.threadDealId)
          return
        }
        toast({
          title: 'No deal found',
          description: 'There is no open deal for this customer.',
          variant: 'destructive',
        })
        return
      }
      if (deals.length === 1) {
        navigatingToDeal = goToDeal(deals[0].id)
        return
      }
      setDealNavChoices(deals)
      setDealNavPickerOpen(true)
    } catch {
      toast({
        title: 'Failure',
        description: 'Could not load deals',
        variant: 'destructive',
      })
    } finally {
      if (!navigatingToDeal) {
        setDealNavLoading(false)
      }
    }
  }

  const handleAddAttachmentToDeal = async (
    attachment: EmailChatAttachment,
    dealId?: number,
  ) => {
    if (!employeeProps) return

    setIsAddingAttachmentToDeal(true)
    try {
      const response = await fetch('/api/email-attachments/add-to-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentId: attachment.id,
          customerEmail: employeeProps.customerEmail || undefined,
          customerName,
          dealId,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const description =
          payload && typeof payload.error === 'string'
            ? payload.error
            : 'Could not add attachment to deal'
        toast({ title: 'Failure', description, variant: 'destructive' })
        return
      }

      if (payload?.status === 'select' && Array.isArray(payload.deals)) {
        setPendingDealAttachment(attachment)
        setAttachmentDealChoices(payload.deals)
        return
      }

      if (payload?.status === 'added') {
        const dealName = payload.deal ? dealOptionName(payload.deal) : 'deal'
        toast({
          title: 'Success',
          description: `Attachment added to ${dealName}`,
          variant: 'success',
        })
        closeAttachmentDealDialog()
      }
    } catch (error) {
      toast({
        title: 'Failure',
        description:
          error instanceof Error ? error.message : 'Could not add attachment to deal',
        variant: 'destructive',
      })
    } finally {
      setIsAddingAttachmentToDeal(false)
    }
  }

  const handleGenerate = async (templateOverride?: string) => {
    if (!employeeProps) return
    const template = templateOverride || selectedTemplate
    if (!template) return
    setIsGenerating(true)
    setMessageText('')
    setActiveTemplateId(null)
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

  const unfilled = useMemo(() => getUnfilledCustomVariables(messageText), [messageText])

  const handleSend = async () => {
    if (!employeeProps) return
    const body = messageText.trim()
    if (!body && attachments.length === 0) return
    if (hasAnyVariables(body)) {
      toast({
        title: 'Placeholders detected',
        description:
          'Please replace all {{placeholders}} with actual values before sending',
        variant: 'destructive',
      })
      return
    }
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
      clearAttachmentPreviews()
      setAttachments([])
      setActiveTemplateId(null)
      toast({
        title: 'Success',
        description: 'Email sent!',
        variant: 'success',
      })
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
    if (!canCompose) return
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      void appendAttachments(Array.from(files))
    }
  }

  const dialogContentClass = embedded
    ? `flex h-full min-h-0 w-full flex-col p-0 transition-colors ${isEmployee && isDragging ? 'bg-blue-50 ring-2 ring-blue-300 ring-dashed' : ''}`
    : `max-w-[100%] sm:max-w-[90%] sm:max-w-[900px] h-[95%] p-0 flex flex-col transition-colors ${isEmployee && isDragging ? 'bg-blue-50 ring-2 ring-blue-300 ring-dashed' : ''}`

  const panelSurfaceProps = {
    className: dialogContentClass,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: canCompose ? handleDrop : undefined,
    onOpenAutoFocus: canCompose
      ? (e: Event) => {
          if (targetMessageId !== null) return
          e.preventDefault()
          focusComposer()
        }
      : undefined,
  }

  const rowClass =
    variant === 'admin'
      ? 'flex items-center gap-2 px-1 py-2 relative'
      : 'flex items-center gap-2 py-3 relative'

  const headerCustomerEmail = (
    employeeProps?.customerEmail ||
    dealNav?.customerEmail ||
    ''
  ).trim()
  const editingAttachmentPreviewUrl = editingAttachment
    ? attachmentPreviews[getAttachmentPreviewKey(editingAttachment)]
    : undefined

  const panelInner = (
    <>
      <DialogHeader className='border-b p-2'>
        <div className='flex w-full items-start gap-3'>
          {readOnly ? (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='shrink-0'
              onClick={onClose}
              aria-label='Back to customer'
            >
              <X className='h-4 w-4' />
            </Button>
          ) : null}
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold text-white'>
            {getInitials(customerName)}
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <DialogTitle className='text-lg font-semibold'>
                {customerName.trim() ? (
                  <CopyText
                    value={customerName.trim()}
                    display={customerName.trim()}
                    className='text-lg font-semibold'
                  />
                ) : (
                  customerName
                )}
              </DialogTitle>
              {dealNav ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <LoadingButton
                        type='button'
                        size='sm'
                        className='shrink-0 gap-1.5'
                        loading={dealNavButtonLoading}
                        onClick={() => void handleDealNavClick()}
                      >
                        <ExternalLink className='h-4 w-4' />
                        <span className='hidden sm:inline'>Go to Deal</span>
                      </LoadingButton>
                    </TooltipTrigger>
                    <TooltipContent>Open customer deal</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
            {headerCustomerEmail ? (
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <CopyText
                  value={headerCustomerEmail}
                  className='text-sm font-medium text-gray-600 break-words text-left'
                />
              </div>
            ) : null}
          </div>
        </div>
      </DialogHeader>

      <div
        ref={scrollContainerRef}
        className='min-w-0 flex-1 overflow-x-hidden overflow-y-auto'
      >
        {chatMessages.map((message, index) => {
          const isGmailReaction = isGmailReactionEmailBody(message.body)
          const visibleAttachments = message.attachments
            ? filterVisibleEmailAttachments(message.attachments)
            : []

          return (
            <div key={message.id}>
              {showDate(message, index) && (
                <div className={dateClass}>
                  {format(new Date(message.sent_at), 'MMM d, yyyy')}
                </div>
              )}
              <div
                className={`${rowClass} min-w-0 ${message.isFromCustomer ? 'flex-row-reverse justify-end pl-2' : 'flex-row-reverse justify-start pr-2'}`}
              >
                <div
                  ref={node => {
                    if (node) {
                      messageRefs.current.set(message.id, node)
                    } else {
                      messageRefs.current.delete(message.id)
                    }
                  }}
                  className={cn(
                    message.isFromCustomer
                      ? 'bg-gray-200 text-black rounded-2xl px-2 py-2 max-w-[75%] min-w-0 break-words [overflow-wrap:anywhere]'
                      : 'bg-blue-500 text-white rounded-2xl px-2 py-2 max-w-[75%] min-w-0 relative pb-6 break-words [overflow-wrap:anywhere]',
                    isGmailReaction &&
                      message.isFromCustomer &&
                      'bg-gray-100 text-gray-700 px-3 py-1.5',
                    'transition-all duration-300 ease-out will-change-transform',
                    highlightedMessageId === message.id &&
                      'ring-1 ring-white/40 shadow-[0_22px_60px_-18px_rgba(15,23,42,0.55),0_8px_24px_-12px_rgba(15,23,42,0.4)] scale-[1.020] z-10',
                  )}
                >
                  <div
                    className={cn(
                      'email-message-body break-words [overflow-wrap:anywhere] text-base leading-[1.45] [&_a]:break-all [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_p]:my-0 [&_strong]:font-semibold [&_ul]:space-y-0.5 [&_ol]:space-y-0.5',
                      isGmailReaction && 'text-sm leading-snug',
                      message.isFromCustomer
                        ? '[&_a]:text-blue-700 [&_p+p]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5'
                        : 'text-white [&_*]:!text-white [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-0.5',
                    )}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Its safe
                    dangerouslySetInnerHTML={{
                      __html: formatEmailBody(
                        message.body,
                        message.isFromCustomer ? null : message.signature,
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
                  {visibleAttachments.length > 0 ? (
                    <div className='mt-3 flex flex-wrap gap-3'>
                      {visibleAttachments.map(attachment => {
                        const mime = `${attachment.content_type}/${attachment.content_subtype}`
                        const label = attachment.filename || mime
                        const isImage = isEmailAttachmentImage(attachment)
                        const isPdf =
                          !isImage &&
                          ((attachment.content_type.toLowerCase() === 'application' &&
                            attachment.content_subtype.toLowerCase() === 'pdf') ||
                            mime.toLowerCase().includes('pdf'))
                        const href = getEmailAttachmentImageSrc(attachment)
                        const linkClass = message.isFromCustomer
                          ? 'text-blue-700 underline'
                          : 'text-white underline'
                        const canAddToDeal = canCompose && !!href && attachment.id > 0

                        return (
                          <div
                            key={attachment.id}
                            className='group relative space-y-2 max-w-[140px]'
                          >
                            {canAddToDeal ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    type='button'
                                    className='absolute top-1 right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-black/10 opacity-100 transition-opacity hover:bg-emerald-50 hover:text-emerald-700 md:opacity-0 md:group-hover:opacity-100'
                                    onClick={e => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleAddAttachmentToDeal(attachment)
                                    }}
                                    disabled={isAddingAttachmentToDeal}
                                    aria-label='Add the file to the deal'
                                  >
                                    <Plus className='h-3.5 w-3.5' />
                                  </TooltipTrigger>
                                  <TooltipContent side='top'>
                                    Add the file to the deal
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : null}
                            {isPdf && href ? (
                              <a
                                href={href}
                                target='_blank'
                                rel='noreferrer'
                                className='block'
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
                              >
                                <span className='inline-flex items-center gap-1'>
                                  <FileText className='h-4 w-4' />
                                  <span>{label}</span>
                                </span>
                              </a>
                            ) : null}
                            {isImage ? (
                              <EmailChatAttachmentImage
                                attachment={attachment}
                                label={label}
                                className={`${fileSize} object-cover rounded-md border border-black/10`}
                                onOpen={() => {
                                  void buildEmailCarouselImages(
                                    visibleAttachments,
                                  ).then(imgs => {
                                    setCurrentImages(imgs)
                                    setCurrentImageId(attachment.id)
                                  })
                                }}
                              />
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
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className='p-2 border-t'>
        {canCompose && attachments.length > 0 && (
          <div className='mb-2 flex flex-wrap gap-2'>
            {attachments.map(file => {
              const previewKey = getAttachmentPreviewKey(file)
              const previewUrl = attachmentPreviews[previewKey]
              const isImageFile = file.type.toLowerCase().startsWith('image/')
              return (
                <div
                  key={previewKey}
                  className={`group relative size-15 shrink-0 rounded border border-border overflow-hidden ${!isImageFile ? 'cursor-pointer' : ''}`}
                  onClick={
                    isImageFile
                      ? undefined
                      : () => {
                          openAttachment(file)
                        }
                  }
                >
                  <button
                    type='button'
                    className='absolute top-0 right-0 z-10 p-0.5 rounded-bl bg-black/60 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100 hover:bg-black/80'
                    onClick={e => {
                      e.stopPropagation()
                      removeAttachment(file)
                    }}
                    aria-label='Remove attachment'
                  >
                    <X className='h-3 w-3' />
                  </button>
                  {isImageFile && previewUrl ? (
                    <button
                      type='button'
                      className='size-full cursor-pointer block focus:outline-none'
                      onClick={e => {
                        e.stopPropagation()
                        setEditingAttachment(file)
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className='size-full object-cover transition-all group-hover:grayscale group-hover:brightness-75'
                      />
                    </button>
                  ) : (
                    <div className='size-full flex items-center justify-center bg-muted text-muted-foreground group-hover:bg-muted/80 transition-colors cursor-pointer'>
                      {attachmentIcon(file.name)}
                    </div>
                  )}
                  <div className='absolute inset-0 pointer-events-none bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                    <span className='text-white text-[10px] text-center line-clamp-2 break-all select-none px-1'>
                      {formatFileName(file.name)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {isEmployee && employeeProps && !readOnly && unfilled.length > 0 && (
          <div className='mb-2 p-2.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md'>
            <p>
              <strong>Action required:</strong> Please replace the following
              placeholders with actual values before sending:
            </p>
            <ul className='mt-1 list-disc list-inside'>
              {unfilled.map(variable => (
                <li key={variable}>
                  <code className='bg-amber-100 px-1 rounded'>{`{{${variable}}}`}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
        {canCompose && employeeProps ? (
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
                          label: 'Use Template',
                          icon: <FileText className='w-4 h-4' />,
                          onClick: () => setShowMobileTemplatePicker(true),
                        },
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

              <div className='hidden md:flex items-end gap-1'>
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
                <EmailTemplatePickerPopover
                  companyId={employeeProps.companyId}
                  onSelect={handleEmailTemplateSelect}
                  activeTemplateId={activeTemplateId}
                />
              </div>

              <input
                ref={fileInputRef}
                type='file'
                className='hidden'
                multiple
                onChange={e => {
                  const files = e.currentTarget.files
                  if (files && files.length > 0) {
                    void appendAttachments(Array.from(files))
                  }
                  e.currentTarget.value = ''
                }}
              />

              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={e => {
                  setMessageText(e.target.value)
                  setActiveTemplateId(null)
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto'
                    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
                  }
                }}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    if (
                      !isSending &&
                      (messageText.trim() !== '' || attachments.length > 0)
                    ) {
                      void handleSend()
                    }
                  }
                }}
                placeholder='Send a message'
                rows={1}
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
                    isSending || (messageText.trim() === '' && attachments.length === 0)
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
      {canCompose && employeeProps && employeeProps.companyId > 0 && (
        <>
          <AttachmentImagePicker
            type='stones'
            companyId={employeeProps.companyId}
            open={showStonesPicker}
            onClose={() => setShowStonesPicker(false)}
            onSelect={files => {
              void appendAttachments(files)
              setShowStonesPicker(false)
            }}
            onAddFiles={appendAttachments}
          />
          <AttachmentImagePicker
            type='images'
            companyId={employeeProps.companyId}
            open={showImagesPicker}
            onClose={() => setShowImagesPicker(false)}
            onSelect={files => {
              void appendAttachments(files)
              setShowImagesPicker(false)
            }}
          />
          <AttachmentImagePicker
            type='documents'
            companyId={employeeProps.companyId}
            open={showDocumentsPicker}
            onClose={() => setShowDocumentsPicker(false)}
            onSelect={files => {
              void appendAttachments(files)
              setShowDocumentsPicker(false)
            }}
          />
        </>
      )}
      {canCompose && employeeProps && (
        <MobileTemplatePicker
          open={showMobileTemplatePicker}
          onOpenChange={open => {
            setShowMobileTemplatePicker(open)
            if (!open) setMobileTemplateSearch('')
          }}
          templates={filteredMobileTemplates}
          isLoading={mobileTemplatesLoading}
          searchQuery={mobileTemplateSearch}
          onSearchChange={setMobileTemplateSearch}
          onSelect={template => {
            const applied = handleEmailTemplateSelect(template)
            if (applied) {
              setShowMobileTemplatePicker(false)
              setMobileTemplateSearch('')
            }
          }}
          activeTemplateId={activeTemplateId}
        />
      )}
      {canCompose && employeeProps && (
        <Dialog
          open={!!pendingDealAttachment && attachmentDealChoices.length > 0}
          onOpenChange={open => {
            if (!open) closeAttachmentDealDialog()
          }}
        >
          <DialogContent className='max-w-md rounded-xl'>
            <DialogHeader>
              <DialogTitle>Choose a deal</DialogTitle>
            </DialogHeader>
            <DealChoiceList
              deals={attachmentDealChoices}
              disabled={!pendingDealAttachment || isAddingAttachmentToDeal}
              onSelectDeal={dealId => {
                if (!pendingDealAttachment) return
                void handleAddAttachmentToDeal(pendingDealAttachment, dealId)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      {dealNav ? (
        <Dialog
          open={dealNavPickerOpen}
          onOpenChange={open => {
            if (!open) closeDealNavPicker()
          }}
        >
          <DialogContent className='max-w-md rounded-xl'>
            <DialogHeader>
              <DialogTitle>Choose a deal</DialogTitle>
            </DialogHeader>
            <DealChoiceList
              deals={dealNavChoices}
              onSelectDeal={dealId => {
                goToDeal(dealId)
                closeDealNavPicker()
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
      <AlertDialog
        open={!!pendingTemplate}
        onOpenChange={open => {
          if (!open) setPendingTemplate(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace message</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current message with the template. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTemplateReplace}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  const panelExtras = (
    <>
      <AttachmentImageEditorDialog
        file={editingAttachment}
        previewUrl={editingAttachmentPreviewUrl}
        open={!!editingAttachment}
        onOpenChange={open => {
          if (!open) setEditingAttachment(null)
        }}
        onSave={file => {
          if (editingAttachment) replaceAttachment(editingAttachment, file)
        }}
      />
      <SuperCarousel
        type='email'
        currentId={currentImageId ?? undefined}
        setCurrentId={id => setCurrentImageId(id ?? null)}
        images={currentImages}
        userRole={variant}
        showInfo={false}
      />
    </>
  )

  if (embedded) {
    return (
      <>
        <div {...panelSurfaceProps}>{panelInner}</div>
        {panelExtras}
      </>
    )
  }

  return (
    <Dialog
      open={true}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent {...panelSurfaceProps}>{panelInner}</DialogContent>
      {panelExtras}
    </Dialog>
  )
}
