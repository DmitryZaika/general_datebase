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

interface ChatAnchorPercent {
  rightPercent: number
  bottomPercent: number
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
const DEFAULT_OFFSET = 20
const FIXED_BASE_CLASS = 'fixed z-50 touch-none'
const DEFAULT_ANCHOR_CLASS = 'bottom-5 right-5'
const APPEARANCE_CLASS = 'transition-opacity duration-300 ease-out'

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 }
  }
  return { width: window.innerWidth, height: window.innerHeight }
}

function defaultAnchorPercent(): ChatAnchorPercent {
  const { width, height } = getViewportSize()
  if (width === 0 || height === 0) {
    return { rightPercent: 2, bottomPercent: 2 }
  }
  return {
    rightPercent: (DEFAULT_OFFSET / width) * 100,
    bottomPercent: (DEFAULT_OFFSET / height) * 100,
  }
}

function clampPercent(percent: ChatAnchorPercent): ChatAnchorPercent {
  const { width, height } = getViewportSize()
  if (width === 0 || height === 0) return percent

  const minRightPercent = (VIEWPORT_PADDING / width) * 100
  const maxRightPercent = ((width - FAB_SIZE - VIEWPORT_PADDING) / width) * 100
  const minBottomPercent = (VIEWPORT_PADDING / height) * 100
  const maxBottomPercent = ((height - FAB_SIZE - VIEWPORT_PADDING) / height) * 100

  return {
    rightPercent: Math.max(
      minRightPercent,
      Math.min(percent.rightPercent, maxRightPercent),
    ),
    bottomPercent: Math.max(
      minBottomPercent,
      Math.min(percent.bottomPercent, maxBottomPercent),
    ),
  }
}

function percentFromPixels(left: number, top: number): ChatAnchorPercent {
  const { width, height } = getViewportSize()
  if (width === 0 || height === 0) return defaultAnchorPercent()

  const rightPixels = width - left - FAB_SIZE
  const bottomPixels = height - top - FAB_SIZE
  return clampPercent({
    rightPercent: (rightPixels / width) * 100,
    bottomPercent: (bottomPixels / height) * 100,
  })
}

function pixelsFromPercent(percent: ChatAnchorPercent): {
  right: number
  bottom: number
} {
  const { width, height } = getViewportSize()
  return {
    right: (percent.rightPercent / 100) * width,
    bottom: (percent.bottomPercent / 100) * height,
  }
}

function leftTopFromPercent(percent: ChatAnchorPercent): {
  left: number
  top: number
} {
  const { width, height } = getViewportSize()
  const { right, bottom } = pixelsFromPercent(percent)
  return {
    left: width - right - FAB_SIZE,
    top: height - bottom - FAB_SIZE,
  }
}

function percentFromPixelAnchor(right: number, bottom: number): ChatAnchorPercent {
  const { width, height } = getViewportSize()
  if (width === 0 || height === 0) return defaultAnchorPercent()
  return clampPercent({
    rightPercent: (right / width) * 100,
    bottomPercent: (bottom / height) * 100,
  })
}

function parseStoredPercent(data: unknown): ChatAnchorPercent | null {
  if (!data || typeof data !== 'object' || typeof window === 'undefined') {
    return null
  }

  if (
    'rightPercent' in data &&
    'bottomPercent' in data &&
    typeof data.rightPercent === 'number' &&
    typeof data.bottomPercent === 'number'
  ) {
    return clampPercent({
      rightPercent: data.rightPercent,
      bottomPercent: data.bottomPercent,
    })
  }

  if (
    'right' in data &&
    'bottom' in data &&
    typeof data.right === 'number' &&
    typeof data.bottom === 'number'
  ) {
    return percentFromPixelAnchor(data.right, data.bottom)
  }

  if (
    'x' in data &&
    'y' in data &&
    typeof data.x === 'number' &&
    typeof data.y === 'number'
  ) {
    return percentFromPixels(data.x, data.y)
  }

  return null
}

function loadStoredPercent(): ChatAnchorPercent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CHAT_POSITION_KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    return parseStoredPercent(data)
  } catch {
    return null
  }
}

function savePercent(percent: ChatAnchorPercent) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify(percent))
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
  originLeft: number
  originTop: number
  didMove: boolean
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [isThinking, setIsThinking] = useState<boolean>(false)
  const [open, setOpen] = useState(false)
  const [useCustomPosition, setUseCustomPosition] = useState(false)
  const [anchor, setAnchor] = useState<ChatAnchorPercent>(defaultAnchorPercent)
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const [viewportRevision, setViewportRevision] = useState(0)
  const anchorRef = useRef(anchor)
  const useCustomPositionRef = useRef(useCustomPosition)
  const dragStateRef = useRef<DragState | null>(null)

  anchorRef.current = anchor
  useCustomPositionRef.current = useCustomPosition

  const applyAnchorFromPixels = useCallback((left: number, top: number) => {
    const clamped = percentFromPixels(left, top)
    anchorRef.current = clamped
    setAnchor(clamped)
    return clamped
  }, [])

  const persistAnchor = useCallback(() => {
    savePercent(anchorRef.current)
  }, [])

  useLayoutEffect(() => {
    const stored = loadStoredPercent()
    if (stored) {
      anchorRef.current = stored
      setAnchor(stored)
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
      setViewportRevision(revision => revision + 1)
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

  const resolveDragOrigin = (e: React.PointerEvent): { left: number; top: number } => {
    if (useCustomPositionRef.current) {
      return leftTopFromPercent(anchorRef.current)
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setUseCustomPosition(true)
    applyAnchorFromPixels(rect.left, rect.top)
    return leftTopFromPercent(anchorRef.current)
  }

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const origin = resolveDragOrigin(e)
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: origin.left,
      originTop: origin.top,
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
    applyAnchorFromPixels(drag.originLeft + dx, drag.originTop + dy)
  }

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragStateRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (drag.didMove) {
      persistAnchor()
    } else {
      setOpen(true)
    }
  }

  const assistantMessage: Message | null = answer
    ? { role: 'assistant', content: answer }
    : null
  const displayMessages: Message[] = assistantMessage
    ? [...messages, assistantMessage]
    : messages

  if (!ready) {
    return null
  }

  const pixelAnchor =
    useCustomPosition && viewportRevision >= 0 ? pixelsFromPercent(anchor) : null
  const positionStyle = pixelAnchor
    ? { right: pixelAnchor.right, bottom: pixelAnchor.bottom }
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
          if (dragStateRef.current?.didMove) persistAnchor()
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
