import type React from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import { DONE_KEY } from '~/utils/constants'
import { DialogFullHeader } from '../molecules/DialogFullHeader'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPosition {
  x: number
  y: number
}

interface ChatMessagesProps {
  messages: Message[]
  isThinking: boolean
}

interface MessageBubbleProps {
  message: Message
}

const CHAT_POSITION_KEY = 'floatingChatPosition'
const FAB_SIZE = 56
const DRAG_THRESHOLD = 6
const VIEWPORT_PADDING = 8
const FIXED_BASE_CLASS = 'fixed z-50 touch-none'
const DEFAULT_ANCHOR_CLASS = 'bottom-5 right-5'
const APPEARANCE_CLASS = 'transition-opacity duration-300 ease-out'

function clampPosition(position: ChatPosition): ChatPosition {
  if (typeof window === 'undefined') return position
  const maxX = window.innerWidth - FAB_SIZE - VIEWPORT_PADDING
  const maxY = window.innerHeight - FAB_SIZE - VIEWPORT_PADDING
  return {
    x: Math.max(VIEWPORT_PADDING, Math.min(position.x, maxX)),
    y: Math.max(VIEWPORT_PADDING, Math.min(position.y, maxY)),
  }
}

function loadStoredPosition(): ChatPosition | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CHAT_POSITION_KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (
      data &&
      typeof data === 'object' &&
      'x' in data &&
      'y' in data &&
      typeof data.x === 'number' &&
      typeof data.y === 'number'
    ) {
      return { x: data.x, y: data.y }
    }
  } catch {
    return null
  }
  return null
}

function savePosition(position: ChatPosition) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify(position))
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

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  didMove: boolean
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [isThinking, setIsThinking] = useState<boolean>(false)
  const [open, setOpen] = useState(false)
  const [useCustomPosition, setUseCustomPosition] = useState(false)
  const [position, setPosition] = useState<ChatPosition>({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const positionRef = useRef(position)
  const useCustomPositionRef = useRef(useCustomPosition)
  const dragStateRef = useRef<DragState | null>(null)

  positionRef.current = position
  useCustomPositionRef.current = useCustomPosition

  const applyPosition = useCallback((next: ChatPosition) => {
    const clamped = clampPosition(next)
    positionRef.current = clamped
    setPosition(clamped)
    return clamped
  }, [])

  const persistPosition = useCallback(() => {
    savePosition(positionRef.current)
  }, [])

  useLayoutEffect(() => {
    const stored = loadStoredPosition()
    if (stored) {
      const clamped = clampPosition(stored)
      positionRef.current = clamped
      setPosition(clamped)
      setUseCustomPosition(true)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    const frame = requestAnimationFrame(() => {
      setVisible(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [ready])

  useEffect(() => {
    if (!useCustomPosition) return
    const onResize = () => {
      setPosition(prev => clampPosition(prev))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [useCustomPosition])

  const addMessage = (message: Message) =>
    setMessages(prevMessages => [...prevMessages, message])

  const handleFormSubmit = async (event: React.FormEvent) => {
    setIsThinking(true)
    setInput('')
    event.preventDefault()

    if (!(event.target instanceof HTMLFormElement)) return
    const formData = new FormData(event.target)
    const queryValue = formData.get('query')
    const query = typeof queryValue === 'string' ? queryValue : ''
    if (answer) {
      addMessage({ role: 'assistant', content: answer })
      setAnswer('')
    }
    addMessage({ role: 'user', content: query })

    const sse = new EventSource(
      `/api/chat?query=${encodeURIComponent(query)}&isNew=${messages.length === 0}`,
    )

    sse.addEventListener('message', event => {
      if (event.data === DONE_KEY) {
        sse.close()
        setIsThinking(false)
      } else {
        setAnswer(prevResults => prevResults + event.data)
      }
    })

    sse.addEventListener('error', () => {
      sse.close()
    })
  }

  const resolveDragOrigin = (e: React.PointerEvent): ChatPosition => {
    if (useCustomPositionRef.current) {
      return positionRef.current
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const origin = { x: rect.left, y: rect.top }
    setUseCustomPosition(true)
    applyPosition(origin)
    return positionRef.current
  }

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const origin = resolveDragOrigin(e)
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: origin.x,
      originY: origin.y,
      didMove: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const moveDrag = (e: React.PointerEvent) => {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.didMove && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    drag.didMove = true
    if (!useCustomPositionRef.current) {
      setUseCustomPosition(true)
    }
    applyPosition({ x: drag.originX + dx, y: drag.originY + dy })
  }

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragStateRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (drag.didMove) {
      applyPosition(positionRef.current)
      persistPosition()
    } else {
      setOpen(true)
    }
  }

  const displayMessages: Message[] = [
    ...messages,
    ...(answer ? [{ role: 'assistant', content: answer }] : []),
  ]

  if (!ready) {
    return null
  }

  const positionStyle = useCustomPosition
    ? { left: position.x, top: position.y }
    : undefined
  const anchorClass = useCustomPosition ? '' : DEFAULT_ANCHOR_CLASS
  const visibilityClass = visible ? 'opacity-100' : 'opacity-0'

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <button
        type='button'
        aria-label='Open chat'
        className={`${FIXED_BASE_CLASS} ${anchorClass} ${APPEARANCE_CLASS} ${visibilityClass} rounded-full bg-blue-500 hover:bg-blue-600 text-white size-14 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg`}
        style={positionStyle}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={e => {
          if (dragStateRef.current?.didMove) persistPosition()
          dragStateRef.current = null
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
        }}
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          fill='none'
          viewBox='0 0 24 24'
          strokeWidth={2}
          stroke='currentColor'
          className='size-6 pointer-events-none'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M12 20.25c4.97 0 9-3.813 9-8.504 0-4.692-4.03-8.496-9-8.496S3 7.054 3 11.746c0 1.846.728 3.559 1.938 4.875L3 20.25l5.455-2.224a10.5 10.5 0 003.545.624z'
          />
        </svg>
      </button>
      <DialogContent
        hideClose
        className='h-full p-0 gap-0'
        position='br'
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
              name='query'
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder='Type your message...'
              className='rounded-full'
              autoFocus={true}
            />
            <Button
              disabled={input.length === 0 || isThinking}
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
