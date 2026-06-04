import { motion, type Variants } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { DONE_KEY } from '~/utils/constants'
import type { MatchedInstruction } from '~/utils/instructionImages'
import { DialogFullHeader } from '../molecules/DialogFullHeader'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import '~/styles/instructions.css'

interface MessageSource {
  id: number
  name: string
  supplierName: string
  url: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  instruction?: MatchedInstruction
  source?: MessageSource
}

interface InstructionCarouselImage {
  id: number
  url: string
  name: string
  type: string
  available: null
}

interface ChatAnchorPercent {
  rightPercent: number
  bottomPercent: number
}

interface ChatMessagesProps {
  messages: Message[]
  isThinking: boolean
  onImageClick: (url: string, urls: string[]) => void
  instructionsPath: string
  status: PriceListStatus | null
}

interface MessageBubbleProps {
  message: Message
  onImageClick: (url: string, urls: string[]) => void
  instructionsPath: string
}

const CHAT_POSITION_KEY = 'floatingChatPosition'
const FAB_SIZE = 56
const DRAG_THRESHOLD = 6
const VIEWPORT_PADDING = 8
const DEFAULT_OFFSET = 20
const FIXED_BASE_CLASS = 'fixed z-50 touch-none'
const DEFAULT_ANCHOR_CLASS = 'bottom-5 right-5'
const APPEARANCE_CLASS = 'transition-opacity duration-300 ease-out'

const IMAGE_LIST_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
}

const IMAGE_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 28,
      mass: 0.75,
    },
  },
}

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

function parseImageUrlsPayload(data: string): string[] {
  try {
    const parsed: unknown = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    const urls: string[] = []
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim()) {
        urls.push(item)
      }
    }
    return urls
  } catch {
    return []
  }
}

interface PriceListStatus {
  state: 'searching' | 'reading' | 'answering'
  fileType?: 'pdf' | 'image' | 'file'
  name?: string
}

function parsePriceListStatus(data: string): PriceListStatus | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) return null
    const state = parsed.state
    if (state !== 'searching' && state !== 'reading' && state !== 'answering') {
      return null
    }
    const status: PriceListStatus = { state }
    if ('fileType' in parsed && typeof parsed.fileType === 'string') {
      if (
        parsed.fileType === 'pdf' ||
        parsed.fileType === 'image' ||
        parsed.fileType === 'file'
      ) {
        status.fileType = parsed.fileType
      }
    }
    if ('name' in parsed && typeof parsed.name === 'string') {
      status.name = parsed.name
    }
    return status
  } catch {
    return null
  }
}

function statusLabel(status: PriceListStatus): string {
  if (status.state === 'searching') return 'Searching supplier files…'
  if (status.state === 'reading') {
    if (status.fileType === 'pdf') {
      return `Downloading PDF${status.name ? `: ${status.name}` : ''}…`
    }
    if (status.fileType === 'image') {
      return `Reading image${status.name ? `: ${status.name}` : ''}…`
    }
    return `Reading file${status.name ? `: ${status.name}` : ''}…`
  }
  return 'Reading documents…'
}

function DownloadingIndicator({ status }: { status: PriceListStatus }) {
  const isPdf = status.fileType === 'pdf'
  return (
    <div className='flex items-center justify-start m-2'>
      <div className='flex items-center gap-3 rounded-xl bg-gray-200 px-4 py-3 text-gray-900'>
        <div className='relative size-7 shrink-0'>
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={1.8}
            className='size-7 text-blue-600'
            aria-hidden='true'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M14 3v4a1 1 0 0 0 1 1h4'
            />
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'
            />
          </svg>
          {isPdf ? (
            <motion.span
              className='absolute inset-x-0 -bottom-0.5 flex justify-center'
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: [-6, 4, -6], opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY }}
            >
              <svg
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2.4}
                className='size-3.5 text-blue-600'
                aria-hidden='true'
              >
                <path strokeLinecap='round' strokeLinejoin='round' d='M12 5v9' />
                <path strokeLinecap='round' strokeLinejoin='round' d='m8 11 4 4 4-4' />
              </svg>
            </motion.span>
          ) : null}
        </div>
        <div className='flex flex-col gap-1'>
          <span className='text-sm'>{statusLabel(status)}</span>
          <span className='relative block h-1 w-32 overflow-hidden rounded-full bg-gray-300'>
            <motion.span
              className='absolute inset-y-0 left-0 w-1/3 rounded-full bg-blue-500'
              animate={{ left: ['-33%', '100%'] }}
              transition={{
                duration: 1.1,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            />
          </span>
        </div>
      </div>
    </div>
  )
}

function parseSourcePayload(data: string): MessageSource | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'url' in parsed &&
      typeof parsed.url === 'string' &&
      'name' in parsed &&
      typeof parsed.name === 'string'
    ) {
      const supplierName =
        'supplierName' in parsed && typeof parsed.supplierName === 'string'
          ? parsed.supplierName
          : ''
      const id = 'id' in parsed && typeof parsed.id === 'number' ? parsed.id : 0
      return { id, name: parsed.name, supplierName, url: parsed.url }
    }
    return null
  } catch {
    return null
  }
}

function parseInstructionPayload(data: string): MatchedInstruction | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (!parsed || typeof parsed !== 'object') return null
    if (!('id' in parsed) || !('title' in parsed)) return null
    if (typeof parsed.id !== 'number' || typeof parsed.title !== 'string') return null
    if (!parsed.title.trim()) return null
    return { id: parsed.id, title: parsed.title }
  } catch {
    return null
  }
}

function buildCarouselImages(urls: string[]): InstructionCarouselImage[] {
  return urls.map((url, index) => ({
    id: index + 1,
    url,
    name: `Instruction ${index + 1}`,
    type: 'instruction',
    available: null,
  }))
}

function InstructionImages({
  urls,
  onImageClick,
}: {
  urls: string[]
  onImageClick: (url: string, urls: string[]) => void
}) {
  if (urls.length === 0) return null
  return (
    <motion.div
      className='instructions mt-2 flex flex-col gap-2'
      variants={IMAGE_LIST_VARIANTS}
      initial='hidden'
      animate='visible'
    >
      {urls.map(url => (
        <motion.button
          key={url}
          type='button'
          className='block cursor-pointer'
          variants={IMAGE_ITEM_VARIANTS}
          onClick={() => onImageClick(url, urls)}
        >
          <img src={url} alt='' className='rounded-md border border-black/10' />
        </motion.button>
      ))}
    </motion.div>
  )
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onImageClick,
  instructionsPath,
}) => {
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
        {message.content ? <div>{message.content}</div> : null}
        {message.source ? (
          <div className='mt-3 pt-2 border-t border-black/10 text-sm'>
            <span className='text-gray-500'>Source: </span>
            <a
              href={message.source.url}
              target='_blank'
              rel='noopener noreferrer'
              className='text-blue-700 underline underline-offset-2 hover:text-blue-900'
            >
              {message.source.name}
              {message.source.supplierName ? ` (${message.source.supplierName})` : ''}
            </a>
          </div>
        ) : null}
        {message.images ? (
          <InstructionImages urls={message.images} onImageClick={onImageClick} />
        ) : null}
        {message.instruction ? (
          <div
            className={`mt-3 pt-2 border-t text-sm ${
              message.role === 'user' ? 'border-white/30' : 'border-black/10'
            }`}
          >
            <Link
              to={`${instructionsPath}?instructionId=${message.instruction.id}`}
              className={
                message.role === 'user'
                  ? 'text-white underline underline-offset-2 hover:text-white/90'
                  : 'text-blue-700 underline underline-offset-2 hover:text-blue-900'
              }
            >
              {message.instruction.title}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isThinking,
  onImageClick,
  instructionsPath,
  status,
}) => (
  <div className='flex flex-col p-4 overflow-y-auto h-full text-wrap whitespace-pre-wrap'>
    {messages.map((message, index) => (
      <MessageBubble
        key={index}
        message={message}
        onImageClick={onImageClick}
        instructionsPath={instructionsPath}
      />
    ))}
    {isThinking && status && status.state !== 'answering' ? (
      <DownloadingIndicator status={status} />
    ) : isThinking ? (
      <div className='flex items-center justify-start m-2'>
        <div className='animate-pulse bg-gray-200 text-gray-900 rounded-xl p-4'>
          Typing...
        </div>
      </div>
    ) : null}
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
  const location = useLocation()
  const instructionsPath = location.pathname.startsWith('/admin')
    ? '/admin/instructions'
    : '/employee/instructions'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const sseRef = useRef<EventSource | null>(null)
  const answerRef = useRef('')
  const streamingImagesRef = useRef<string[]>([])
  const streamingInstructionRef = useRef<MatchedInstruction | null>(null)
  const streamingSourceRef = useRef<MessageSource | null>(null)
  const responseFinishedRef = useRef(false)
  const [carouselImages, setCarouselImages] = useState<InstructionCarouselImage[]>([])
  const [currentImageId, setCurrentImageId] = useState<number | undefined>(undefined)
  const [priceListMode, setPriceListMode] = useState(false)
  const [priceListStatus, setPriceListStatus] = useState<PriceListStatus | null>(null)

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

  const openInstructionImage = useCallback((url: string, urls: string[]) => {
    const images = buildCarouselImages(urls)
    const clicked = images.find(image => image.url === url)
    setCarouselImages(images)
    setCurrentImageId(clicked?.id ?? images[0]?.id)
  }, [])

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
      const images = streamingImagesRef.current
      const instruction = streamingInstructionRef.current
      const source = streamingSourceRef.current
      answerRef.current = ''
      streamingImagesRef.current = []
      streamingInstructionRef.current = null
      streamingSourceRef.current = null
      setAnswer('')
      setIsThinking(false)
      setPriceListStatus(null)
      if (content.length > 0 || images.length > 0 || instruction || source) {
        setMessages(msgs => [
          ...msgs,
          {
            role: 'assistant',
            content,
            images: images.length > 0 ? images : undefined,
            instruction: instruction ?? undefined,
            source: source ?? undefined,
          },
        ])
      }
      focusInput()
    },
    [focusInput],
  )

  const stopResponse = useCallback(() => {
    const sse = sseRef.current
    if (!sse || responseFinishedRef.current) return
    finishResponse(sse)
  }, [finishResponse])

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
    streamingImagesRef.current = []
    streamingInstructionRef.current = null
    streamingSourceRef.current = null
    setAnswer('')
    setIsThinking(true)
    setPriceListStatus(priceListMode ? { state: 'searching' } : null)
    setInput('')
    addMessage({ role: 'user', content: query })

    sseRef.current?.close()
    const chatMode = priceListMode ? 'priceLists' : 'instructions'
    const sse = new EventSource(
      `/api/chat?query=${encodeURIComponent(query)}&isNew=${isNewChat}&mode=${chatMode}`,
    )
    sseRef.current = sse

    sse.addEventListener('status', event => {
      const status = parsePriceListStatus(event.data)
      if (status) setPriceListStatus(status)
    })

    sse.addEventListener('instruction', event => {
      const instruction = parseInstructionPayload(event.data)
      if (!instruction) return
      streamingInstructionRef.current = instruction
    })

    sse.addEventListener('images', event => {
      const urls = parseImageUrlsPayload(event.data)
      if (urls.length === 0) return
      streamingImagesRef.current = urls
    })

    sse.addEventListener('source', event => {
      const source = parseSourcePayload(event.data)
      if (!source) return
      streamingSourceRef.current = source
    })

    sse.addEventListener('message', event => {
      if (event.data === DONE_KEY) {
        finishResponse(sse)
        return
      }
      answerRef.current += event.data
      setAnswer(answerRef.current)
      setPriceListStatus(null)
    })

    sse.addEventListener('error', () => {
      finishResponse(sse)
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

  const displayMessages: Message[] =
    isThinking && answer.length > 0
      ? [
          ...messages,
          {
            role: 'assistant',
            content: answer,
          },
        ]
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
    <>
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
            <ChatMessages
              messages={displayMessages}
              isThinking={isThinking && !answer}
              onImageClick={openInstructionImage}
              instructionsPath={instructionsPath}
              status={priceListStatus}
            />
            <div className='border-t border-gray-300 bg-gray-100'>
              {priceListMode ? (
                <div className='px-4 pt-3'>
                  <div className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800'>
                    <span>Price lists</span>
                    <button
                      type='button'
                      aria-label='Close price lists mode'
                      className='rounded-full p-0.5 hover:bg-blue-200'
                      onClick={() => setPriceListMode(false)}
                    >
                      <X className='size-3.5' />
                    </button>
                  </div>
                </div>
              ) : null}
              <form onSubmit={handleFormSubmit} className='p-4 flex items-center gap-2'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      className='shrink-0 rounded-full'
                      disabled={isThinking}
                      aria-label='Open chat tools'
                    >
                      <Plus className='size-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='start' side='top'>
                    <DropdownMenuItem onClick={() => setPriceListMode(true)}>
                      Price lists
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Input
                  ref={inputRef}
                  name='query'
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  placeholder='Type your message...'
                  className='rounded-full'
                  enterKeyHint='send'
                />
                {isThinking ? (
                  <Button
                    type='button'
                    variant='destructive'
                    className='rounded-full shrink-0'
                    onClick={stopResponse}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    disabled={input.trim().length === 0}
                    variant='blue'
                    type='submit'
                    className='rounded-full shrink-0'
                  >
                    Send
                  </Button>
                )}
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <SuperCarousel
        type='instruction'
        currentId={currentImageId}
        setCurrentId={setCurrentImageId}
        images={carouselImages}
        showInfo={false}
      />
    </>
  )
}
