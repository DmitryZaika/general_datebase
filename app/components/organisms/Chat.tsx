import { MessageCircle } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import { DONE_KEY } from '~/utils/constants'
import { DialogFullHeader } from '../molecules/DialogFullHeader'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatMessagesProps {
  messages: Message[]
  isThinking: boolean
}

interface MessageBubbleProps {
  message: Message
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`rounded-xl p-3 m-2 max-w-xl ${
          message.role === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 text-gray-900'
        }`}
      >
        <div>{message.content}</div>
      </div>
    </div>
  )
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isThinking }) => (
  <div className='flex flex-col p-4 overflow-y-auto h-full text-wrap whitespace-pre-wrap'>
    {messages.map((message, index) => (
      <MessageBubble key={index} message={message} />
    ))}
    {isThinking && (
      <div className='flex items-center justify-start m-2'>
        <div className='animate-pulse bg-gray-200 text-gray-900 rounded-xl p-4'>
          Typing...
        </div>
      </div>
    )}
  </div>
)

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [isThinking, setIsThinking] = useState<boolean>(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sseRef = useRef<EventSource | null>(null)
  const answerRef = useRef('')
  const responseFinishedRef = useRef(false)

  const addMessage = (message: Message) =>
    setMessages(prevMessages => [...prevMessages, message])

  const focusInput = useCallback(() => {
    const focus = () => {
      inputRef.current?.focus()
    }
    requestAnimationFrame(focus)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setTimeout(focus, 100)
      setTimeout(focus, 350)
    }
  }, [])

  useEffect(() => {
    if (open) {
      focusInput()
    }
  }, [open, focusInput])

  const finishResponse = useCallback(
    (sse: EventSource) => {
      if (responseFinishedRef.current) return
      responseFinishedRef.current = true
      sse.close()
      if (sseRef.current === sse) {
        sseRef.current = null
      }
      const content = answerRef.current
      answerRef.current = ''
      setAnswer('')
      setIsThinking(false)
      if (content.length > 0) {
        setMessages(msgs => [...msgs, { role: 'assistant', content }])
      }
      focusInput()
    },
    [focusInput],
  )

  useEffect(() => {
    return () => {
      sseRef.current?.close()
    }
  }, [])

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = input.trim()
    if (!query || isThinking) return

    const isNewChat = messages.length === 0
    responseFinishedRef.current = false
    answerRef.current = ''
    setAnswer('')
    setIsThinking(true)
    setInput('')
    addMessage({ role: 'user', content: query })

    sseRef.current?.close()
    const sse = new EventSource(
      `/api/chat?query=${encodeURIComponent(query)}&isNew=${isNewChat}`,
    )
    sseRef.current = sse

    sse.addEventListener('message', event => {
      if (event.data === DONE_KEY) {
        finishResponse(sse)
        return
      }
      answerRef.current += event.data
      setAnswer(answerRef.current)
    })

    sse.addEventListener('error', () => {
      finishResponse(sse)
    })
  }

  const displayMessages: Message[] =
    isThinking && answer.length > 0
      ? [...messages, { role: 'assistant', content: answer }]
      : messages

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <button
        type='button'
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        className='flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-600 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0'
      >
        <MessageCircle className='size-5 shrink-0' />
        <span className='group-data-[collapsible=icon]:hidden'>Chat</span>
      </button>
      <DialogContent
        hideClose
        className='h-full p-0 gap-0'
        position='br'
        onOpenAutoFocus={e => {
          e.preventDefault()
          focusInput()
        }}
        onInteractOutside={e => {
          e.preventDefault()
        }}
      >
        <div className='h-full w-full bg-white border-l border-gray-300 shadow-lg flex flex-col overflow-y-auto'>
          <DialogFullHeader>
            <span className='text-lg font-bold'>Chat</span>
          </DialogFullHeader>
          <ChatMessages messages={displayMessages} isThinking={isThinking && !answer} />
          <form
            onSubmit={handleFormSubmit}
            className='p-4 bg-gray-100 border-t border-gray-300 flex items-center gap-2'
          >
            <Input
              ref={inputRef}
              name='query'
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder='Type your message...'
              className='rounded-full'
              enterKeyHint='send'
            />
            <Button
              disabled={input.trim().length === 0 || isThinking}
              variant='blue'
              type='submit'
              className='rounded-full'
            >
              Send
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
