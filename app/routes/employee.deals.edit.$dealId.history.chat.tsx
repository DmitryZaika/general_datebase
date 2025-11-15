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

  const [customerRows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name, c.phone
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ?`,
    [dealId],
  )

  const [emailRows] = await db.execute<RowDataPacket[]>(
    `SELECT e.id, e.subject, e.body, e.sent_at
       FROM emails e
      WHERE e.message_id = ? AND e.deleted_at IS NULL
      ORDER BY e.sent_at ASC`,
    [dealId],
  )

  const messages: Message[] = (emailRows || []).map(row => ({
    id: row.id,
    subject: row.subject,
    body: row.body,
    sent_at: row.sent_at,
  }))

  return {
    customerName: customerRows?.[0]?.name || 'Customer',
    customerPhone: customerRows?.[0]?.phone || '',
    messages,
  }
}

export default function EmailChatDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showSelect, setShowSelect] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const { customerName, customerPhone, messages } = useLoaderData<typeof loader>()
  const [messageText, setMessageText] = useState('')
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

  const generateWithAI = () => {
    console.log('generateWithAI')
  }

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[700px] h-[550px] p-0 flex flex-col'>
        <DialogHeader className='p-4 border-b'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold'>
              {getInitials(customerName)}
            </div>
            <div>
              <DialogTitle className='text-lg font-semibold'>{customerName}</DialogTitle>
              <p className='text-sm text-gray-500'>{customerPhone}</p>
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

        <div className='p-4 border-t'>
          <div className='flex items-center gap-2 '>
          {
                showSelect ? (
                  <div className="flex gap-2 ">
                        <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className='w-[150px]'>
                      <SelectValue placeholder='Select template' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='first-contact'>First contact</SelectItem>
                      <SelectItem value='follow-up'>Follow-up</SelectItem>
                      <SelectItem value='reply'>Reply</SelectItem>
                    </SelectContent>
                  </Select>
                  <LoadingButton type='button' loading={false} onClick={() => generateWithAI()}>Generate</LoadingButton>
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
