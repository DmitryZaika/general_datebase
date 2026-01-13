import { format } from 'date-fns'
import { Pencil } from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useEffect, useRef, useState } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { presignIfS3Uri } from '~/utils/s3Presign.server'
import { getAdminUser, type User } from '~/utils/session.server'

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
    user = await getAdminUser(request)
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
    throw new Error('Thread ID is missing')
  }

  const [customerRows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name, c.email
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ?`,
    [dealId],
  )

  const normalizeEmail = (email: string | null | undefined) => email?.trim().toLowerCase() || ''
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
        try {
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
        } catch (error) {
          console.error('Parse error:', error)
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
  const location = useLocation()
  const {
    customerName,
    customerEmail,
    messages,
    dealId,
    subject,
  
  } = useLoaderData<typeof loader>()
  const [chatMessages, setChatMessages] = useState<Message[]>(messages)
 
  const bottomRef = useRef<HTMLDivElement | null>(null)

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages.length])



  const handleClose = () => {
    navigate(`/admin/deals/edit/${dealId}/history${location.search}`)
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
                  <p className='whitespace-pre-wrap'>
                    {getDisplayBody(
                      message.body,
                      message.isFromCustomer ? null : message.signature,
                    )}
                  </p>
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
                    <div className='mt-3 space-y-2'>
                      {message.attachments.map(attachment => {
                        const mime = `${attachment.content_type}/${attachment.content_subtype}`
                        const label = attachment.filename || mime
                        const isImage =
                          attachment.content_type.toLowerCase() === 'image'
                        const href = attachment.signed_url || attachment.url
                        const linkClass = message.isFromCustomer
                          ? 'text-blue-700 underline'
                          : 'text-white underline'

                        return (
                          <div key={attachment.id} className='space-y-2'>
                            {href ? (
                              <a
                                href={href}
                                target='_blank'
                                rel='noreferrer'
                                className={linkClass}
                              ></a>
                            ) : null}
                            {isImage && href ? (
                              <a href={href} target='_blank' rel='noreferrer'>
                                <img
                                  src={href}
                                  alt={label}
                                  className='max-h-48 rounded-md border border-black/10'
                                />
                              </a>
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
      </DialogContent>
    </Dialog>
  )
}
