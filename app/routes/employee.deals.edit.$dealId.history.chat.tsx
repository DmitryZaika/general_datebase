import type { RowDataPacket } from 'mysql2'
import { useEffect, useRef, useState } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

interface Message {
  id: number
  subject: string
  body: string
  sent_at: string
  isFromCustomer: boolean
  read_at?: string
}

interface AIEmailResponse {
  subject?: string
  bodyText?: string
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
  const url = new URL(request.url)
  const subjectFilter = url.searchParams.get('subject') || undefined

  const [customerRows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name, c.email
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ?`,
    [dealId],
  )

  const customerEmail = customerRows?.[0]?.email || ''

  let emailQuery = `SELECT e.id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, er.read_at
       FROM emails e
       LEFT JOIN email_reads er ON e.message_id = er.message_id
      WHERE e.deal_id = ? AND e.deleted_at IS NULL`
  const emailParams: (number | string)[] = [dealId]
  if (subjectFilter) {
    emailQuery += ' AND e.subject = ?'
    emailParams.push(subjectFilter)
  }

  emailQuery += ' ORDER BY e.sent_at ASC'

  const [emailRows] = await db.execute<RowDataPacket[]>(emailQuery, emailParams)

  const messages: Message[] = (emailRows || []).map(row => {
    const isFromCustomer = row.sender_email === customerEmail
    return {
      id: row.id,
      subject: row.subject,
      body: row.body,
      sent_at: row.sent_at,
      isFromCustomer,
      read_at: row.read_at,
    }
  })
  console.log(messages)

  return {
    customerName: customerRows?.[0]?.name || 'Customer',
    customerEmail,
    messages,
    dealId,
    subject: subjectFilter || null,
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
  onStreamBody?: (text: string) => void,
): Promise<AIEmailResponse> {
  const variationToken = Math.random().toString(36).slice(2)
  const requestPayload = {
    emailCategory,
    dealId,
    variationToken,
    subject: subject || undefined,
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

function MessageDate({message}: {message: Message}) {
  const date = new Date(message.sent_at)
  const time = date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit' })
  return <p className='text-xs text-gray-500 text-left'>{time}</p>
}

export default function EmailChatDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showSelect, setShowSelect] = useState(false)
  const [selectActive, setSelectActive] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const { customerName, customerEmail, messages, dealId, subject } =
    useLoaderData<typeof loader>()
  const [messageText, setMessageText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [messageText])

  const handleClose = () => {
    navigate(`..${location.search}`)
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const lastMessageFromMe = [...messages].reverse().find(m => !m.isFromCustomer)
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
      await generateAIEmailForChat(template, dealId, subject, body => {
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

  function showDate(message: Message, index: number) {
    return index === 0 || 
      new Date(messages[index - 1].sent_at).toDateString() !== 
      new Date(message.sent_at).toDateString()
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
              <DialogTitle className='text-lg font-semibold'>{customerName}</DialogTitle>
              <p className='text-sm text-gray-500'>{customerEmail}</p>
            </div>
          </div>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto p-4 space-y-4'>
          {messages.map((message, index) => (
              <div key={message.id}>
                {showDate(message, index) && (
                  <div className='text-center text-xs text-gray-500 my-4'>
                    Today
                  </div>
                )}
                <div
                  className={
                    message.isFromCustomer
                      ? 'flex justify-start'
                      : 'flex justify-end w-full'
                  }
                >
                  <div className={`flex items-center gap-2 ${message.isFromCustomer ? 'flex-row-reverse justify-end' : 'flex-row-reverse justify-start'}`}>
                      {!message.isFromCustomer && <MessageDate message={message} />}
                    <div
                      className={
                        message.isFromCustomer
                          ? 'bg-gray-200 text-black rounded-2xl px-4 py-3 max-w-[75%]'
                          : 'bg-blue-500 text-white rounded-2xl px-4 py-3 max-w-[75%]'
                      }
                    >
                      <p className='whitespace-pre-wrap'>{message.body}</p>
                    </div>
                  <div className="flex items-center gap-2">
                   {message.isFromCustomer && <MessageDate message={message} />}
                   {!message.isFromCustomer && message.id === lastReadMessageId && (
                     <p className='text-xs text-gray-500'>Read</p>
                   )}
                   </div>
                  </div>
               
                </div  >
               
              </div>
            ))}
        </div>

        <div className='p-4 border-t'>
          <div className='flex items-end gap-2'>
          {
                showSelect ? (
                  <div className="flex gap-2 items-end">
                        <Select
                          open={selectActive}
                          onOpenChange={setSelectActive}
                          value={selectedTemplate}
                          onValueChange={value => handleTemplateSelect(value)}
                        >
                    <SelectTrigger className='w-[150px]'>
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
                  <LoadingButton loading={isGenerating} type='button'  onClick={() => handleGenerate()}>Generate</LoadingButton>
                  </div>
                ) : (
                  <Button
                    type='button'
                    onClick={() => {
                      setShowSelect(true);
                      setSelectActive(true);
                    }}
                  >
                    Generate with AI
                  </Button>
                )
              }
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
              className='flex-1 min-h-[38px] max-h-40 rounded-sm border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none resize-none overflow-y-auto'
            />
            <Button variant='ghost' size='icon' className='text-zinc-500 mb-1'>
              <span className='text-xl'>➤</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
