import type { RowDataPacket } from 'mysql2'
import { useRef, useState } from 'react'
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

  let emailQuery = `SELECT e.id, e.subject, e.body, e.sent_at
       FROM emails e
      WHERE e.deal_id = ? AND e.deleted_at IS NULL`
  const emailParams: (number | string)[] = [dealId]

  if (subjectFilter) {
    emailQuery += ' AND e.subject = ?'
    emailParams.push(subjectFilter)
  }

  emailQuery += ' ORDER BY e.sent_at ASC'

  const [emailRows] = await db.execute<RowDataPacket[]>(emailQuery, emailParams)

  const messages: Message[] = (emailRows || []).map(row => ({
    id: row.id,
    subject: row.subject,
    body: row.body,
    sent_at: row.sent_at,
  }))

  return {
    customerName: customerRows?.[0]?.name || 'Customer',
    customerEmail: customerRows?.[0]?.email || '',
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

export default function EmailChatDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showSelect, setShowSelect] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const { customerName, customerEmail, messages, dealId, subject } =
    useLoaderData<typeof loader>()
  const [messageText, setMessageText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

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

  const handleTemplateSelect = (value: string) => {
    setSelectedTemplate(value)
  }

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      return
    }
    setIsGenerating(true)
    setMessageText('')
    try {
      await generateAIEmailForChat(selectedTemplate, dealId, subject, body => {
        setMessageText(body)
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
          }
        }, 0)
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
          {messages.map((message, index) => {
            const showDate = index === 0 || 
              new Date(messages[index - 1].sent_at).toDateString() !== 
              new Date(message.sent_at).toDateString()

            return (
              <div key={message.id}>
                {showDate && (
                  <div className='text-center text-xs text-gray-500 my-4'>
                    Today
                  </div>
                )}
                <div className='flex justify-end'>
                  <div className='bg-blue-500 text-white rounded-2xl px-4 py-3 max-w-[75%]'>
                    <p className='whitespace-pre-wrap'>{message.body}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className='p-10 border-t'>
          <div className='flex items-center gap-2 h-full'>
          {
                showSelect ? (
                  <div className="flex gap-2 ">
                        <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
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
                  <LoadingButton type='button' loading={isGenerating} onClick={handleGenerate}>
                    Generate
                  </LoadingButton>
                  </div>
                ) : (
                  <Button type='button' onClick={() => setShowSelect(true)}>Generate with AI</Button>
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
              className='flex-1 max-h-40 rounded-sm border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none resize-none'
            />
            <Button variant='ghost' size='icon' className='text-zinc-500'>
              <span className='text-xl'>➤</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
