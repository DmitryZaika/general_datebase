import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ImagePlus, Plus, Sparkles, X } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  type DesignStone,
  StoneNameSearch,
} from '~/components/molecules/StoneNameSearch'
import { SupplierNameSearch } from '~/components/molecules/SupplierNameSearch'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import '~/styles/instructions.css'
import { stripChatResponseMarkersTrimmed } from '~/utils/chatAnswerHelpers'
import { DONE_KEY } from '~/utils/constants'
import type { MatchedInstruction } from '~/utils/instructionImages'
import {
  appendSpecialOrderPrompt,
  inferSpecialOrderOfferFromAnswer,
  isSpecialOrderQuoteContent,
  parseSlabsAndDelivery,
} from '~/utils/specialOrderCalculator'
import { DialogFullHeader } from '../molecules/DialogFullHeader'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Input } from '../ui/input'
import { Skeleton } from '../ui/skeleton'
import { Textarea } from '../ui/textarea'

interface MessageSource {
  id: number
  name: string
  supplierName: string
  url: string
}

type AiDesignSurface = 'countertops' | 'fireplace' | 'full_height_backsplash'

const AI_DESIGN_SURFACE_OPTIONS: { id: AiDesignSurface; label: string }[] = [
  { id: 'countertops', label: 'Countertops' },
  { id: 'fireplace', label: 'Fireplace' },
  { id: 'full_height_backsplash', label: 'Full height backsplash' },
]

function formatAiDesignSurfaces(surfaces: AiDesignSurface[]): string {
  const labels = AI_DESIGN_SURFACE_OPTIONS.filter(option =>
    surfaces.includes(option.id),
  ).map(option => option.label.toLowerCase())
  if (labels.length === 0) return 'countertops'
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

interface SpecialOrderOffer {
  pricePerSqft: number
  lengthInches: number
  widthInches: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  instructions?: MatchedInstruction[]
  sources?: MessageSource[]
  specialOrderOffer?: SpecialOrderOffer
  specialOrderQuote?: boolean
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
  specialOrderFormIndex: number | null
  recalculateFormIndex: number | null
  onSpecialOrderYes: (messageIndex: number, offer: SpecialOrderOffer) => void
  onSpecialOrderCalculate: (
    slabs: number,
    deliveryCost: number,
    messageIndex: number,
  ) => void
  onRecalculate: (messageIndex: number, offer: SpecialOrderOffer) => void
  pendingQuoteSkeletonIndex: number | null
  dismissingQuoteSkeletonIndex: number | null
  onQuoteSkeletonExitComplete: () => void
  isClearingChat: boolean
  clearStaggerTotal: number
  onClearAnimationComplete: () => void
  isCreatingImage: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
}

interface MessageBubbleProps {
  message: Message
  onImageClick: (url: string, urls: string[]) => void
  instructionsPath: string
  showSpecialOrderYes: boolean
  specialOrderFormOpen: boolean
  showRecalculate: boolean
  recalculateFormOpen: boolean
  showQuotePendingSkeleton: boolean
  quoteSkeletonExiting: boolean
  onQuoteSkeletonExitComplete: () => void
  onSpecialOrderYes: () => void
  onSpecialOrderCalculate: (slabs: number, deliveryCost: number) => void
  onRecalculate: () => void
  calculationDisabled: boolean
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

const QUOTE_LIST_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
}

const QUOTE_LINE_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const FORM_EXPAND_EASE = [0.22, 1, 0.36, 1] as const
const FORM_EXPAND_DURATION = 0.45
const SKELETON_EXIT_DURATION = 0.4
const SCROLL_STICK_THRESHOLD = 64
const SCROLL_SMOOTH_MIN_STEP = 5
const SCROLL_SMOOTH_MAX_STEP = 30

const MESSAGE_CLEAR_VARIANTS: Variants = {
  exit: (custom: { staggerIndex: number; staggerTotal: number }) => ({
    opacity: 0,
    y: -14,
    scale: 0.92,
    transition: {
      duration: 0.32,
      delay: (custom.staggerTotal - 1 - custom.staggerIndex) * 0.045,
      ease: FORM_EXPAND_EASE,
    },
  }),
}

const THINKING_CLEAR_VARIANTS: Variants = {
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.94,
    transition: { duration: 0.28, ease: FORM_EXPAND_EASE },
  },
}

function AnimatedExpandPanel({
  open,
  children,
  innerClassName,
  measureKey,
}: {
  open: boolean
  children: React.ReactNode
  innerClassName?: string
  measureKey?: string | number | boolean
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  useLayoutEffect(() => {
    const node = innerRef.current
    if (!node || !open) return

    const measure = () => {
      setContentHeight(node.scrollHeight)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [open, measureKey])

  return (
    <motion.div
      className='overflow-hidden'
      initial={false}
      animate={{
        height: open ? contentHeight : 0,
        opacity: open ? 1 : 0,
      }}
      transition={{
        height: { duration: FORM_EXPAND_DURATION, ease: FORM_EXPAND_EASE },
        opacity: {
          duration: open ? 0.32 : 0.2,
          ease: 'easeOut',
        },
      }}
    >
      <div ref={innerRef} className={innerClassName}>
        {children}
      </div>
    </motion.div>
  )
}

function AnimatedPriceListMenu({
  open,
  color,
  onColorChange,
  supplier,
  onSupplierChange,
  isThinking,
  onClose,
  onSubmit,
  onStop,
}: {
  open: boolean
  color: string
  onColorChange: (value: string) => void
  supplier: string
  onSupplierChange: (value: string) => void
  isThinking: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
  onStop: () => void
}) {
  useLayoutEffect(() => {
    if (!open) return
    const timer = window.setTimeout(
      () => {
        const input = document.getElementById('price-list-color-input')
        if (input instanceof HTMLInputElement) {
          input.focus()
        }
      },
      Math.round(FORM_EXPAND_DURATION * 1000),
    )
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <AnimatedExpandPanel open={open} measureKey={`${color}-${supplier}-${isThinking}`}>
      <div className='px-4 pt-3'>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 8 }}
          transition={{ duration: 0.28, ease: FORM_EXPAND_EASE }}
          className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800'
        >
          <span>Price list</span>
          <button
            type='button'
            aria-label='Close price lists mode'
            className='rounded-full p-0.5 hover:bg-blue-200'
            onClick={onClose}
          >
            <X className='size-3.5' />
          </button>
        </motion.div>
      </div>
      <form
        onSubmit={onSubmit}
        className='flex flex-col gap-3 border-t border-gray-200 p-4'
      >
        <motion.label
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
          transition={{
            duration: 0.32,
            delay: open ? 0.06 : 0,
            ease: FORM_EXPAND_EASE,
          }}
          className='flex flex-col gap-1 text-sm'
        >
          <span>Color</span>
          <Input
            id='price-list-color-input'
            value={color}
            onChange={event => onColorChange(event.target.value)}
            placeholder='Enter color name'
            disabled={isThinking}
          />
        </motion.label>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
          transition={{ duration: 0.32, delay: open ? 0.1 : 0, ease: FORM_EXPAND_EASE }}
          className='flex flex-col gap-1 text-sm'
        >
          <span>From which supplier</span>
          <label className='flex flex-col gap-1'>
            <span className='text-zinc-500'>Supplier</span>
            <SupplierNameSearch
              value={supplier}
              onChange={onSupplierChange}
              disabled={isThinking}
            />
          </label>
        </motion.div>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
          transition={{
            duration: 0.32,
            delay: open ? 0.14 : 0,
            ease: FORM_EXPAND_EASE,
          }}
        >
          {isThinking ? (
            <Button
              type='button'
              variant='destructive'
              className='shrink-0 self-start rounded-full'
              onClick={onStop}
            >
              Stop
            </Button>
          ) : (
            <Button
              type='submit'
              variant='blue'
              className='shrink-0 self-start rounded-full'
              disabled={color.trim().length === 0 || supplier.trim().length === 0}
            >
              Find price
            </Button>
          )}
        </motion.div>
      </form>
    </AnimatedExpandPanel>
  )
}

function AnimatedAiDesignMenu({
  open,
  image,
  stones,
  surfaces,
  extraInstructions,
  isGenerating,
  onAttachClick,
  onImageDrop,
  onRemoveImage,
  onAddStone,
  onRemoveStone,
  onToggleSurface,
  onExtraInstructionsChange,
  onClose,
  onGenerate,
}: {
  open: boolean
  image: { file: File; previewUrl: string } | null
  stones: DesignStone[]
  surfaces: AiDesignSurface[]
  extraInstructions: string
  isGenerating: boolean
  onAttachClick: () => void
  onImageDrop: (file: File) => void
  onRemoveImage: () => void
  onAddStone: (stone: DesignStone) => void
  onRemoveStone: (id: number) => void
  onToggleSurface: (surface: AiDesignSurface) => void
  onExtraInstructionsChange: (value: string) => void
  onClose: () => void
  onGenerate: () => void
}) {
  const [dragActive, setDragActive] = useState(false)
  const canGenerate =
    Boolean(image) && stones.length > 0 && surfaces.length > 0 && !isGenerating

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) {
      onImageDrop(file)
    }
  }

  return (
    <AnimatedExpandPanel
      open={open}
      measureKey={`${image?.previewUrl ?? 'none'}-${stones.length}-${surfaces.join('-')}-${extraInstructions}-${isGenerating}`}
    >
      <div className='px-4 pt-3'>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 8 }}
          transition={{ duration: 0.28, ease: FORM_EXPAND_EASE }}
          className='inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800'
        >
          <Sparkles className='size-3.5' />
          <span>AI Design</span>
          <button
            type='button'
            aria-label='Close AI Design mode'
            className='rounded-full p-0.5 hover:bg-purple-200'
            onClick={onClose}
          >
            <X className='size-3.5' />
          </button>
        </motion.div>
      </div>
      <div className='flex flex-col gap-3 border-t border-gray-200 p-4'>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
          transition={{
            duration: 0.32,
            delay: open ? 0.06 : 0,
            ease: FORM_EXPAND_EASE,
          }}
          className='flex flex-col gap-1 text-sm'
        >
          <span>Kitchen photo</span>
          {image ? (
            <div className='flex items-center gap-3 rounded-lg border border-gray-300 bg-white p-2'>
              <img
                src={image.previewUrl}
                alt='Kitchen preview'
                className='size-16 shrink-0 rounded-md object-cover'
              />
              <span className='flex-1 truncate text-sm text-gray-700'>
                {image.file.name}
              </span>
              <button
                type='button'
                aria-label='Remove kitchen photo'
                className='rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                onClick={onRemoveImage}
                disabled={isGenerating}
              >
                <X className='size-4' />
              </button>
            </div>
          ) : (
            <button
              type='button'
              onClick={onAttachClick}
              onDragOver={event => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
                dragActive
                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                  : 'border-gray-300 bg-white text-gray-500 hover:border-purple-300 hover:text-purple-600'
              }`}
            >
              <ImagePlus className='size-6' />
              <span>Attach a picture</span>
              <span className='text-xs text-gray-400'>
                Click, paste (Ctrl+V) or drag &amp; drop
              </span>
            </button>
          )}
        </motion.div>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
          transition={{ duration: 0.32, delay: open ? 0.1 : 0, ease: FORM_EXPAND_EASE }}
          className='flex flex-col gap-1 text-sm'
        >
          <span>Stones to install (max 3)</span>
          <StoneNameSearch
            selected={stones}
            onAdd={onAddStone}
            onRemove={onRemoveStone}
            disabled={isGenerating}
            maxStones={3}
          />
        </motion.div>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
          transition={{
            duration: 0.32,
            delay: open ? 0.12 : 0,
            ease: FORM_EXPAND_EASE,
          }}
          className='flex flex-col gap-2 text-sm'
        >
          <span>Install on</span>
          <ul className='flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3'>
            {AI_DESIGN_SURFACE_OPTIONS.map(option => {
              const checked = surfaces.includes(option.id)
              const inputId = `ai-design-surface-${option.id}`
              return (
                <li key={option.id}>
                  <label
                    htmlFor={inputId}
                    className='flex cursor-pointer items-center gap-2'
                  >
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      disabled={isGenerating}
                      onCheckedChange={() => onToggleSurface(option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </motion.div>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
          transition={{
            duration: 0.32,
            delay: open ? 0.13 : 0,
            ease: FORM_EXPAND_EASE,
          }}
          className='flex flex-col gap-1 text-sm'
        >
          <span>Extra instructions</span>
          <Textarea
            value={extraInstructions}
            onChange={event => onExtraInstructionsChange(event.target.value)}
            disabled={isGenerating}
            placeholder='e.g. change cabinets to white, run veining left to right…'
            rows={3}
            className='resize-none bg-white'
          />
        </motion.div>
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
          transition={{
            duration: 0.32,
            delay: open ? 0.14 : 0,
            ease: FORM_EXPAND_EASE,
          }}
        >
          <Button
            type='button'
            variant='blue'
            className='shrink-0 self-start rounded-full'
            disabled={!canGenerate}
            onClick={onGenerate}
          >
            {isGenerating ? 'Generating…' : 'Generate design'}
          </Button>
        </motion.div>
      </div>
    </AnimatedExpandPanel>
  )
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

function parseSpecialOrderOfferPayload(data: string): SpecialOrderOffer | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'pricePerSqft' in parsed &&
      typeof parsed.pricePerSqft === 'number' &&
      'lengthInches' in parsed &&
      typeof parsed.lengthInches === 'number' &&
      'widthInches' in parsed &&
      typeof parsed.widthInches === 'number'
    ) {
      return {
        pricePerSqft: parsed.pricePerSqft,
        lengthInches: parsed.lengthInches,
        widthInches: parsed.widthInches,
      }
    }
    return null
  } catch {
    return null
  }
}

function buildSpecialOrderParams(offer: SpecialOrderOffer): string {
  return [
    `specialOrderPrice=${encodeURIComponent(String(offer.pricePerSqft))}`,
    `specialOrderLength=${encodeURIComponent(String(offer.lengthInches))}`,
    `specialOrderWidth=${encodeURIComponent(String(offer.widthInches))}`,
  ].join('&')
}

function parseInstructionPayload(data: string): MatchedInstruction | null {
  const parsed = parseInstructionsPayload(data)
  return parsed.length > 0 ? parsed[0] : null
}

function parseInstructionsPayload(data: string): MatchedInstruction[] {
  try {
    const parsed: unknown = JSON.parse(data)
    if (Array.isArray(parsed)) {
      const items: MatchedInstruction[] = []
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue
        if (!('id' in entry) || !('title' in entry)) continue
        if (typeof entry.id !== 'number' || typeof entry.title !== 'string') continue
        if (!entry.title.trim()) continue
        items.push({ id: entry.id, title: entry.title })
      }
      return items
    }
    if (!parsed || typeof parsed !== 'object') return []
    if (!('id' in parsed) || !('title' in parsed)) return []
    if (typeof parsed.id !== 'number' || typeof parsed.title !== 'string') return []
    if (!parsed.title.trim()) return []
    return [{ id: parsed.id, title: parsed.title }]
  } catch {
    return []
  }
}

function parseSourcesPayload(data: string): MessageSource[] {
  try {
    const parsed: unknown = JSON.parse(data)
    if (Array.isArray(parsed)) {
      const items: MessageSource[] = []
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue
        if (
          !('id' in entry) ||
          !('name' in entry) ||
          !('supplierName' in entry) ||
          !('url' in entry)
        ) {
          continue
        }
        if (
          typeof entry.id !== 'number' ||
          typeof entry.name !== 'string' ||
          typeof entry.supplierName !== 'string' ||
          typeof entry.url !== 'string'
        ) {
          continue
        }
        if (!entry.name.trim() || !entry.url.trim()) continue
        items.push({
          id: entry.id,
          name: entry.name,
          supplierName: entry.supplierName,
          url: entry.url,
        })
      }
      return items
    }
    const single = parseSourcePayload(data)
    return single ? [single] : []
  } catch {
    return []
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

function renderMessageContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function SpecialOrderQuoteContent({ content }: { content: string }) {
  const lines = content.split('\n').filter(line => line.trim().length > 0)
  return (
    <motion.div
      className='flex flex-col gap-1'
      variants={QUOTE_LIST_VARIANTS}
      initial='hidden'
      animate='visible'
    >
      {lines.map((line, index) => (
        <motion.div key={`${index}-${line}`} variants={QUOTE_LINE_VARIANTS}>
          {line.startsWith('Price per sqft (with tax & delivery):') ? (
            <strong>{line}</strong>
          ) : (
            line
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

function AnimatedSkeletonWrapper({
  exiting,
  onExitComplete,
  children,
}: {
  exiting: boolean
  onExitComplete: () => void
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 1, scale: 1 }}
      animate={exiting ? { opacity: 0, scale: 0.86 } : { opacity: 1, scale: 1 }}
      transition={{
        duration: SKELETON_EXIT_DURATION,
        ease: FORM_EXPAND_EASE,
      }}
      style={{ transformOrigin: 'top center' }}
      onAnimationComplete={() => {
        if (exiting) {
          onExitComplete()
        }
      }}
    >
      {children}
    </motion.div>
  )
}

function SpecialOrderFormSkeleton() {
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1'>
        <Skeleton className='h-4 w-24' />
        <Skeleton className='h-9 w-full' />
      </div>
      <div className='flex flex-col gap-1'>
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-9 w-full' />
      </div>
      <Skeleton className='h-8 w-32' />
    </div>
  )
}

function AnimatedSpecialOrderPanel({
  mode,
  formKey,
  skeletonExiting,
  onSkeletonExitComplete,
  onYes,
  onCalculate,
  onRecalculate,
  disabled,
}: {
  mode: 'yes' | 'form' | 'skeleton' | 'recalculate' | null
  formKey: string
  skeletonExiting: boolean
  onSkeletonExitComplete: () => void
  onYes: () => void
  onCalculate: (slabs: number, deliveryCost: number) => void
  onRecalculate: () => void
  disabled: boolean
}) {
  const panelOpen = mode !== null
  return (
    <AnimatedExpandPanel
      open={panelOpen}
      innerClassName='border-t border-black/10 pt-3'
      measureKey={`${formKey}-${mode}-${skeletonExiting}`}
    >
      {mode === 'yes' ? (
        <Button type='button' size='sm' variant='blue' onClick={onYes}>
          Yes
        </Button>
      ) : null}
      {mode === 'form' ? (
        <SpecialOrderForm onCalculate={onCalculate} disabled={disabled} />
      ) : null}
      {mode === 'skeleton' ? (
        <AnimatedSkeletonWrapper
          exiting={skeletonExiting}
          onExitComplete={onSkeletonExitComplete}
        >
          <SpecialOrderFormSkeleton />
        </AnimatedSkeletonWrapper>
      ) : null}
      {mode === 'recalculate' ? (
        <Button type='button' size='sm' variant='outline' onClick={onRecalculate}>
          Recalculate
        </Button>
      ) : null}
    </AnimatedExpandPanel>
  )
}

function SpecialOrderForm({
  onCalculate,
  disabled,
}: {
  onCalculate: (slabs: number, deliveryCost: number) => void
  disabled: boolean
}) {
  const [deliveryCost, setDeliveryCost] = useState('')
  const [slabs, setSlabs] = useState('1')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const slabsCount = Number.parseInt(slabs, 10)
    const delivery = Number.parseFloat(deliveryCost)
    if (!Number.isFinite(slabsCount) || slabsCount <= 0) return
    if (!Number.isFinite(delivery) || delivery < 0) return
    onCalculate(slabsCount, delivery)
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
      <label className='flex flex-col gap-1 text-sm'>
        <span>Delivery cost</span>
        <Input
          type='number'
          min={0}
          step={1}
          placeholder='0'
          value={deliveryCost}
          onChange={event => setDeliveryCost(event.target.value)}
          onWheel={event => event.preventDefault()}
          disabled={disabled}
        />
      </label>
      <label className='flex flex-col gap-1 text-sm'>
        <span>Amount of slabs</span>
        <Input
          type='number'
          min={1}
          step={1}
          placeholder='1'
          value={slabs}
          onChange={event => setSlabs(event.target.value)}
          onWheel={event => event.preventDefault()}
          disabled={disabled}
        />
      </label>
      <Button type='submit' variant='blue' size='sm' disabled={disabled}>
        Calculate price
      </Button>
    </form>
  )
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
  showSpecialOrderYes,
  specialOrderFormOpen,
  showRecalculate,
  recalculateFormOpen,
  showQuotePendingSkeleton,
  quoteSkeletonExiting,
  onQuoteSkeletonExitComplete,
  onSpecialOrderYes,
  onSpecialOrderCalculate,
  onRecalculate,
  calculationDisabled,
}) => {
  let specialOrderActionMode: 'yes' | 'form' | 'skeleton' | 'recalculate' | null = null
  if (showQuotePendingSkeleton) {
    specialOrderActionMode = 'skeleton'
  } else if (specialOrderFormOpen || recalculateFormOpen) {
    specialOrderActionMode = 'form'
  } else if (showSpecialOrderYes) {
    specialOrderActionMode = 'yes'
  } else if (showRecalculate) {
    specialOrderActionMode = 'recalculate'
  }

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
        {message.content ? (
          message.specialOrderQuote ? (
            <SpecialOrderQuoteContent content={message.content} />
          ) : (
            <div>{renderMessageContent(message.content)}</div>
          )
        ) : null}
        <AnimatedSpecialOrderPanel
          mode={specialOrderActionMode}
          formKey={
            recalculateFormOpen
              ? 'recalculate-special-order-form'
              : 'special-order-form'
          }
          skeletonExiting={quoteSkeletonExiting}
          onSkeletonExitComplete={onQuoteSkeletonExitComplete}
          onYes={onSpecialOrderYes}
          onCalculate={onSpecialOrderCalculate}
          onRecalculate={onRecalculate}
          disabled={calculationDisabled}
        />
        {message.sources && message.sources.length > 0 ? (
          <div className='mt-3 pt-2 border-t border-black/10 text-sm'>
            <div className='text-gray-500 mb-1'>
              {message.sources.length === 1 ? 'Source' : 'Sources'}
            </div>
            <div className='flex flex-col gap-1'>
              {message.sources.map(source => (
                <a
                  key={source.id}
                  href={source.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-700 underline underline-offset-2 hover:text-blue-900'
                >
                  {source.name}
                  {source.supplierName ? ` (${source.supplierName})` : ''}
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {message.images ? (
          <InstructionImages urls={message.images} onImageClick={onImageClick} />
        ) : null}
        {message.instructions && message.instructions.length > 0 ? (
          <div
            className={`mt-3 pt-2 border-t text-sm ${
              message.role === 'user' ? 'border-white/30' : 'border-black/10'
            }`}
          >
            <div
              className={
                message.role === 'user' ? 'text-white/80 mb-1' : 'text-gray-500 mb-1'
              }
            >
              {message.instructions.length === 1 ? 'Source' : 'Sources'}
            </div>
            <div className='flex flex-col gap-1'>
              {message.instructions.map(instruction => (
                <Link
                  key={instruction.id}
                  to={`${instructionsPath}?instructionId=${instruction.id}`}
                  className={
                    message.role === 'user'
                      ? 'text-white underline underline-offset-2 hover:text-white/90'
                      : 'text-blue-700 underline underline-offset-2 hover:text-blue-900'
                  }
                >
                  {instruction.title}
                </Link>
              ))}
            </div>
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
  specialOrderFormIndex,
  recalculateFormIndex,
  onSpecialOrderYes,
  onSpecialOrderCalculate,
  onRecalculate,
  pendingQuoteSkeletonIndex,
  dismissingQuoteSkeletonIndex,
  onQuoteSkeletonExitComplete,
  isClearingChat,
  clearStaggerTotal,
  onClearAnimationComplete,
  isCreatingImage,
  scrollRef,
  contentRef,
}) => {
  const showTypingIndicator =
    isThinking &&
    pendingQuoteSkeletonIndex === null &&
    dismissingQuoteSkeletonIndex === null &&
    !(status && status.state !== 'answering')

  return (
    <div
      ref={scrollRef}
      className='flex flex-col flex-1 min-h-0 p-4 overflow-y-auto text-wrap whitespace-pre-wrap'
    >
      <div ref={contentRef} className='flex flex-col'>
        <AnimatePresence mode='sync' onExitComplete={onClearAnimationComplete}>
          {messages.map((message, index) => {
            const hasUserReplyAfter = messages
              .slice(index + 1)
              .some(item => item.role === 'user')
            const isLatestPriceOffer =
              message.specialOrderOffer !== undefined &&
              !message.specialOrderQuote &&
              !messages
                .slice(index + 1)
                .some(
                  item =>
                    item.specialOrderOffer !== undefined && !item.specialOrderQuote,
                )
            const showSpecialOrderYes =
              !isThinking &&
              !hasUserReplyAfter &&
              isLatestPriceOffer &&
              specialOrderFormIndex !== index
            const specialOrderFormOpen =
              specialOrderFormIndex === index &&
              message.specialOrderOffer !== undefined &&
              !message.specialOrderQuote
            const showRecalculate =
              !isThinking &&
              message.specialOrderQuote === true &&
              message.specialOrderOffer !== undefined &&
              recalculateFormIndex !== index
            const recalculateFormOpen =
              recalculateFormIndex === index && message.specialOrderOffer !== undefined
            const showQuotePendingSkeleton =
              (isThinking && pendingQuoteSkeletonIndex === index) ||
              dismissingQuoteSkeletonIndex === index
            const quoteSkeletonExiting = dismissingQuoteSkeletonIndex === index
            const staggerTotal = clearStaggerTotal || messages.length

            return (
              <motion.div
                key={`chat-message-${index}`}
                custom={{ staggerIndex: index, staggerTotal }}
                variants={MESSAGE_CLEAR_VARIANTS}
                initial={false}
                exit={
                  isClearingChat ? 'exit' : { opacity: 1, transition: { duration: 0 } }
                }
              >
                <MessageBubble
                  message={message}
                  onImageClick={onImageClick}
                  instructionsPath={instructionsPath}
                  showSpecialOrderYes={showSpecialOrderYes}
                  specialOrderFormOpen={specialOrderFormOpen}
                  showRecalculate={showRecalculate}
                  recalculateFormOpen={recalculateFormOpen}
                  showQuotePendingSkeleton={showQuotePendingSkeleton}
                  quoteSkeletonExiting={quoteSkeletonExiting}
                  onQuoteSkeletonExitComplete={onQuoteSkeletonExitComplete}
                  onSpecialOrderYes={() => {
                    if (message.specialOrderOffer) {
                      onSpecialOrderYes(index, message.specialOrderOffer)
                    }
                  }}
                  onSpecialOrderCalculate={(slabs, deliveryCost) => {
                    onSpecialOrderCalculate(slabs, deliveryCost, index)
                  }}
                  onRecalculate={() => {
                    if (message.specialOrderOffer) {
                      onRecalculate(index, message.specialOrderOffer)
                    }
                  }}
                  calculationDisabled={isThinking || isClearingChat}
                />
              </motion.div>
            )
          })}
          {isThinking && status && status.state !== 'answering' ? (
            <motion.div
              key='chat-downloading-indicator'
              variants={THINKING_CLEAR_VARIANTS}
              initial={false}
              exit={
                isClearingChat ? 'exit' : { opacity: 1, transition: { duration: 0 } }
              }
            >
              <DownloadingIndicator status={status} />
            </motion.div>
          ) : showTypingIndicator ? (
            <motion.div
              key='chat-typing-indicator'
              variants={THINKING_CLEAR_VARIANTS}
              initial={false}
              exit={
                isClearingChat ? 'exit' : { opacity: 1, transition: { duration: 0 } }
              }
              className='flex items-center justify-start m-2'
            >
              <div className='animate-pulse bg-gray-200 text-gray-900 rounded-xl p-4'>
                {isCreatingImage
                  ? 'Creating image... It may take up to 1 minute.'
                  : 'Typing...'}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

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
  const streamingInstructionsRef = useRef<MatchedInstruction[]>([])
  const streamingSourcesRef = useRef<MessageSource[]>([])
  const streamingSpecialOrderOfferRef = useRef<SpecialOrderOffer | null>(null)
  const pendingQuoteOfferRef = useRef<SpecialOrderOffer | null>(null)
  const pendingQuoteSkeletonIndexRef = useRef<number | null>(null)
  const responseFinishedRef = useRef(false)
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)
  const messagesContentRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const smoothScrollActiveRef = useRef(false)
  const scrollAnimationFrameRef = useRef<number | null>(null)
  const [carouselImages, setCarouselImages] = useState<InstructionCarouselImage[]>([])
  const [currentImageId, setCurrentImageId] = useState<number | undefined>(undefined)
  const [priceListMode, setPriceListMode] = useState(false)
  const [priceListFormOpen, setPriceListFormOpen] = useState(false)
  const [priceListColor, setPriceListColor] = useState('')
  const [priceListSupplier, setPriceListSupplier] = useState('')
  const [priceListStatus, setPriceListStatus] = useState<PriceListStatus | null>(null)
  const [activeSpecialOrder, setActiveSpecialOrder] =
    useState<SpecialOrderOffer | null>(null)
  const [specialOrderFormIndex, setSpecialOrderFormIndex] = useState<number | null>(
    null,
  )
  const [recalculateFormIndex, setRecalculateFormIndex] = useState<number | null>(null)
  const [pendingQuoteSkeletonIndex, setPendingQuoteSkeletonIndex] = useState<
    number | null
  >(null)
  const [dismissingQuoteSkeletonIndex, setDismissingQuoteSkeletonIndex] = useState<
    number | null
  >(null)
  const [isClearingChat, setIsClearingChat] = useState(false)
  const [clearStaggerTotal, setClearStaggerTotal] = useState(0)
  const [clearingSnapshot, setClearingSnapshot] = useState<Message[] | null>(null)
  const [aiDesignFormOpen, setAiDesignFormOpen] = useState(false)
  const [aiDesignImage, setAiDesignImage] = useState<{
    file: File
    previewUrl: string
  } | null>(null)
  const [aiDesignStones, setAiDesignStones] = useState<DesignStone[]>([])
  const [aiDesignSurfaces, setAiDesignSurfaces] = useState<AiDesignSurface[]>([
    'countertops',
  ])
  const [aiDesignExtraInstructions, setAiDesignExtraInstructions] = useState('')
  const [isGeneratingDesign, setIsGeneratingDesign] = useState(false)
  const aiDesignImageInputRef = useRef<HTMLInputElement>(null)
  const createdObjectUrlsRef = useRef<Set<string>>(new Set())

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

  const stopSmoothScroll = useCallback(() => {
    smoothScrollActiveRef.current = false
    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current)
      scrollAnimationFrameRef.current = null
    }
  }, [])

  const runSmoothScrollFrame = useCallback(() => {
    const container = messagesScrollRef.current
    if (!container || !smoothScrollActiveRef.current) {
      scrollAnimationFrameRef.current = null
      return
    }

    const target = Math.max(0, container.scrollHeight - container.clientHeight)
    const current = container.scrollTop
    const distance = target - current

    if (distance <= 0.5) {
      container.scrollTop = target
      smoothScrollActiveRef.current = false
      scrollAnimationFrameRef.current = null
      return
    }

    const step = Math.min(
      Math.max(distance * 0.14, SCROLL_SMOOTH_MIN_STEP),
      SCROLL_SMOOTH_MAX_STEP,
    )
    container.scrollTop = current + step
    scrollAnimationFrameRef.current = requestAnimationFrame(runSmoothScrollFrame)
  }, [])

  const scrollMessagesToBottom = useCallback(
    (smooth = true) => {
      const container = messagesScrollRef.current
      if (!container) return
      stickToBottomRef.current = true

      if (!smooth) {
        stopSmoothScroll()
        container.scrollTop = Math.max(
          0,
          container.scrollHeight - container.clientHeight,
        )
        return
      }

      smoothScrollActiveRef.current = true
      if (scrollAnimationFrameRef.current === null) {
        scrollAnimationFrameRef.current = requestAnimationFrame(runSmoothScrollFrame)
      }
    },
    [runSmoothScrollFrame, stopSmoothScroll],
  )

  const triggerSmoothScrollFollow = useCallback(() => {
    scrollMessagesToBottom(true)
  }, [scrollMessagesToBottom])

  useLayoutEffect(() => {
    if (!open || isClearingChat) return
    scrollMessagesToBottom(true)
  }, [
    answer,
    dismissingQuoteSkeletonIndex,
    isClearingChat,
    messages,
    open,
    pendingQuoteSkeletonIndex,
    priceListFormOpen,
    priceListStatus,
    recalculateFormIndex,
    scrollMessagesToBottom,
    specialOrderFormIndex,
  ])

  useEffect(() => {
    if (!open) return
    const container = messagesScrollRef.current
    const content = messagesContentRef.current
    if (!container || !content) return

    const onScroll = () => {
      stickToBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <=
        SCROLL_STICK_THRESHOLD
    }

    const onContentResize = () => {
      if (stickToBottomRef.current && !isClearingChat) {
        scrollMessagesToBottom(true)
      }
    }

    onScroll()
    const observer = new ResizeObserver(onContentResize)
    observer.observe(content)
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      container.removeEventListener('scroll', onScroll)
    }
  }, [isClearingChat, open, scrollMessagesToBottom])

  useEffect(() => stopSmoothScroll, [stopSmoothScroll])

  const finishResponse = useCallback(
    (sse: EventSource) => {
      if (responseFinishedRef.current) return
      responseFinishedRef.current = true
      sse.close()
      if (sseRef.current === sse) {
        sseRef.current = null
      }
      const rawAnswer = answerRef.current
      let content = stripChatResponseMarkersTrimmed(rawAnswer)
      const images = streamingImagesRef.current
      const instructions = streamingInstructionsRef.current
      const sources = streamingSourcesRef.current
      const isSpecialOrderQuote = isSpecialOrderQuoteContent(content)
      let specialOrderOffer = streamingSpecialOrderOfferRef.current
      if (!specialOrderOffer && !isSpecialOrderQuote) {
        specialOrderOffer = inferSpecialOrderOfferFromAnswer(rawAnswer)
      }
      if (
        specialOrderOffer &&
        !isSpecialOrderQuote &&
        !content.includes('Would you like me to adjust this price for a special order')
      ) {
        content = appendSpecialOrderPrompt(content)
      }
      const quoteOffer = pendingQuoteOfferRef.current
      answerRef.current = ''
      streamingImagesRef.current = []
      streamingInstructionsRef.current = []
      streamingSourcesRef.current = []
      streamingSpecialOrderOfferRef.current = null
      pendingQuoteOfferRef.current = null
      setAnswer('')
      setIsThinking(false)
      const skeletonIndex = pendingQuoteSkeletonIndexRef.current
      pendingQuoteSkeletonIndexRef.current = null
      setPendingQuoteSkeletonIndex(null)
      if (isSpecialOrderQuote && skeletonIndex !== null) {
        setDismissingQuoteSkeletonIndex(skeletonIndex)
      }
      setPriceListStatus(null)
      if (isSpecialOrderQuote) {
        setActiveSpecialOrder(null)
        setSpecialOrderFormIndex(null)
        setRecalculateFormIndex(null)
      } else if (specialOrderOffer) {
        setActiveSpecialOrder(specialOrderOffer)
        setSpecialOrderFormIndex(null)
        setRecalculateFormIndex(null)
      }
      if (
        content.length > 0 ||
        images.length > 0 ||
        instructions.length > 0 ||
        sources.length > 0 ||
        specialOrderOffer ||
        isSpecialOrderQuote
      ) {
        setMessages(msgs => [
          ...msgs,
          {
            role: 'assistant',
            content,
            images: images.length > 0 ? images : undefined,
            instructions: instructions.length > 0 ? instructions : undefined,
            sources: sources.length > 0 ? sources : undefined,
            specialOrderOffer: isSpecialOrderQuote
              ? (quoteOffer ?? undefined)
              : (specialOrderOffer ?? undefined),
            specialOrderQuote: isSpecialOrderQuote ? true : undefined,
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
    const objectUrls = createdObjectUrlsRef.current
    return () => {
      sseRef.current?.close()
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl)
      }
      objectUrls.clear()
    }
  }, [])

  const sendChatQuery = useCallback(
    (
      query: string,
      options?: {
        aiQuery?: string
        imageId?: string
        imagePreviewUrl?: string
      },
    ) => {
      const aiQuery = options?.aiQuery ?? query
      if ((!aiQuery && !options?.imageId) || isThinking) return

      const isNewChat = messages.filter(message => message.role === 'user').length === 0
      responseFinishedRef.current = false
      answerRef.current = ''
      streamingImagesRef.current = []
      streamingInstructionsRef.current = []
      streamingSourcesRef.current = []
      streamingSpecialOrderOfferRef.current = null
      setAnswer('')
      setIsThinking(true)
      triggerSmoothScrollFollow()
      setPriceListStatus(
        priceListMode
          ? activeSpecialOrder
            ? { state: 'answering' }
            : { state: 'searching' }
          : null,
      )
      setInput('')
      addMessage({
        role: 'user',
        content: query,
        images: options?.imagePreviewUrl ? [options.imagePreviewUrl] : undefined,
      })

      sseRef.current?.close()
      const chatMode = priceListMode ? 'priceLists' : 'instructions'
      const parsedSpecialOrder = parseSlabsAndDelivery(aiQuery)
      const specialOrderParams =
        priceListMode &&
        activeSpecialOrder &&
        parsedSpecialOrder.slabs !== undefined &&
        parsedSpecialOrder.deliveryCost !== undefined
          ? `&${buildSpecialOrderParams(activeSpecialOrder)}`
          : ''
      const imageParam = options?.imageId
        ? `&imageId=${encodeURIComponent(options.imageId)}`
        : ''
      const sse = new EventSource(
        `/api/chat?query=${encodeURIComponent(aiQuery)}&isNew=${isNewChat}&mode=${chatMode}${specialOrderParams}${imageParam}`,
      )
      sseRef.current = sse

      sse.addEventListener('status', event => {
        const status = parsePriceListStatus(event.data)
        if (status) setPriceListStatus(status)
      })

      sse.addEventListener('instructions', event => {
        const instructions = parseInstructionsPayload(event.data)
        if (instructions.length === 0) return
        streamingInstructionsRef.current = instructions
      })

      sse.addEventListener('instruction', event => {
        const instruction = parseInstructionPayload(event.data)
        if (!instruction) return
        streamingInstructionsRef.current = [instruction]
      })

      sse.addEventListener('images', event => {
        const urls = parseImageUrlsPayload(event.data)
        if (urls.length === 0) return
        streamingImagesRef.current = urls
      })

      sse.addEventListener('sources', event => {
        const sources = parseSourcesPayload(event.data)
        if (sources.length === 0) return
        streamingSourcesRef.current = sources
      })

      sse.addEventListener('source', event => {
        const source = parseSourcePayload(event.data)
        if (!source) return
        streamingSourcesRef.current = [source]
      })

      sse.addEventListener('specialOrderOffer', event => {
        const offer = parseSpecialOrderOfferPayload(event.data)
        if (!offer) return
        streamingSpecialOrderOfferRef.current = offer
      })

      sse.addEventListener('message', event => {
        if (event.data === DONE_KEY) {
          finishResponse(sse)
          return
        }
        answerRef.current += event.data
        setAnswer(stripChatResponseMarkersTrimmed(answerRef.current))
        setPriceListStatus(null)
      })

      sse.addEventListener('error', () => {
        finishResponse(sse)
      })
    },
    [
      activeSpecialOrder,
      finishResponse,
      isThinking,
      messages.length,
      priceListMode,
      triggerSmoothScrollFollow,
    ],
  )

  const handleSpecialOrderYes = useCallback(
    (messageIndex: number, offer: SpecialOrderOffer) => {
      triggerSmoothScrollFollow()
      setActiveSpecialOrder(offer)
      setSpecialOrderFormIndex(messageIndex)
    },
    [triggerSmoothScrollFollow],
  )

  const handleSpecialOrderCalculate = useCallback(
    (slabs: number, deliveryCost: number, messageIndex: number) => {
      if (activeSpecialOrder) {
        pendingQuoteOfferRef.current = activeSpecialOrder
      }
      pendingQuoteSkeletonIndexRef.current = messageIndex
      setPendingQuoteSkeletonIndex(messageIndex)
      setSpecialOrderFormIndex(null)
      setRecalculateFormIndex(null)
      sendChatQuery(`${slabs} slabs, delivery $${deliveryCost}`)
    },
    [activeSpecialOrder, sendChatQuery],
  )

  const handleQuoteSkeletonExitComplete = useCallback(() => {
    setDismissingQuoteSkeletonIndex(null)
  }, [])

  const finishClearChatState = useCallback(() => {
    setIsClearingChat(false)
    setClearStaggerTotal(0)
    setClearingSnapshot(null)
    setInput('')
    setAnswer('')
    setIsThinking(false)
    setPriceListMode(false)
    setPriceListFormOpen(false)
    setPriceListColor('')
    setPriceListSupplier('')
    setPriceListStatus(null)
    setActiveSpecialOrder(null)
    setSpecialOrderFormIndex(null)
    setRecalculateFormIndex(null)
    setPendingQuoteSkeletonIndex(null)
    setDismissingQuoteSkeletonIndex(null)
    pendingQuoteSkeletonIndexRef.current = null
    pendingQuoteOfferRef.current = null
    answerRef.current = ''
    streamingImagesRef.current = []
    streamingInstructionsRef.current = []
    streamingSourcesRef.current = []
    streamingSpecialOrderOfferRef.current = null
    responseFinishedRef.current = true
    setAiDesignFormOpen(false)
    setAiDesignStones([])
    setAiDesignSurfaces(['countertops'])
    setAiDesignExtraInstructions('')
    setAiDesignImage(null)
    setIsGeneratingDesign(false)
    for (const objectUrl of createdObjectUrlsRef.current) {
      URL.revokeObjectURL(objectUrl)
    }
    createdObjectUrlsRef.current.clear()
    focusInput()
  }, [focusInput])

  const handleClearAnimationComplete = useCallback(() => {
    if (!isClearingChat) return
    finishClearChatState()
  }, [finishClearChatState, isClearingChat])

  const handleClearChat = useCallback(() => {
    if (isClearingChat) return
    const snapshot: Message[] = [...messages]
    if (isThinking && answer.length > 0) {
      snapshot.push({ role: 'assistant', content: answer })
    }
    const hasTypingIndicator =
      isThinking &&
      pendingQuoteSkeletonIndex === null &&
      dismissingQuoteSkeletonIndex === null &&
      !(priceListStatus && priceListStatus.state !== 'answering')
    const hasDownloadingIndicator =
      isThinking && priceListStatus !== null && priceListStatus.state !== 'answering'
    const messageCount =
      snapshot.length + (hasTypingIndicator ? 1 : 0) + (hasDownloadingIndicator ? 1 : 0)
    if (messageCount === 0) return

    responseFinishedRef.current = true
    sseRef.current?.close()
    sseRef.current = null
    setClearStaggerTotal(messageCount)
    setIsClearingChat(true)
    setIsThinking(false)
    setAnswer('')
    answerRef.current = ''
    setPriceListStatus(null)
    setPendingQuoteSkeletonIndex(null)
    setDismissingQuoteSkeletonIndex(null)
    pendingQuoteSkeletonIndexRef.current = null
    setMessages([])
    setClearingSnapshot(snapshot)
    requestAnimationFrame(() => {
      setClearingSnapshot([])
    })
  }, [
    answer,
    dismissingQuoteSkeletonIndex,
    isClearingChat,
    isThinking,
    messages,
    pendingQuoteSkeletonIndex,
    priceListStatus,
  ])

  const handleRecalculate = useCallback(
    (messageIndex: number, offer: SpecialOrderOffer) => {
      triggerSmoothScrollFollow()
      setActiveSpecialOrder(offer)
      setRecalculateFormIndex(messageIndex)
      setSpecialOrderFormIndex(null)
    },
    [triggerSmoothScrollFollow],
  )

  const removeAiDesignImage = useCallback(() => {
    setAiDesignImage(prev => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl)
        createdObjectUrlsRef.current.delete(prev.previewUrl)
      }
      return null
    })
  }, [])

  const closePriceListMode = useCallback(() => {
    setPriceListMode(false)
    setPriceListFormOpen(false)
    setPriceListColor('')
    setPriceListSupplier('')
  }, [])

  const enablePriceListMode = useCallback(() => {
    setPriceListMode(true)
    setPriceListFormOpen(true)
    setPriceListColor('')
    setPriceListSupplier('')
    setActiveSpecialOrder(null)
    setSpecialOrderFormIndex(null)
    setRecalculateFormIndex(null)
    setAiDesignFormOpen(false)
    setAiDesignStones([])
    setAiDesignSurfaces(['countertops'])
    setAiDesignExtraInstructions('')
    removeAiDesignImage()
    triggerSmoothScrollFollow()
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: 'Which color would you like me to find?',
      },
    ])
  }, [removeAiDesignImage, triggerSmoothScrollFollow])

  const closeAiDesignMode = useCallback(() => {
    setAiDesignFormOpen(false)
    setAiDesignStones([])
    setAiDesignSurfaces(['countertops'])
    setAiDesignExtraInstructions('')
    removeAiDesignImage()
  }, [removeAiDesignImage])

  const setAiDesignImageFromFile = useCallback((file: File | null | undefined) => {
    if (!file?.type.startsWith('image/')) return
    setAiDesignImage(prev => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl)
        createdObjectUrlsRef.current.delete(prev.previewUrl)
      }
      const previewUrl = URL.createObjectURL(file)
      createdObjectUrlsRef.current.add(previewUrl)
      return { file, previewUrl }
    })
  }, [])

  const enableAiDesignMode = useCallback(() => {
    setAiDesignFormOpen(true)
    setAiDesignStones([])
    setAiDesignSurfaces(['countertops'])
    setAiDesignExtraInstructions('')
    removeAiDesignImage()
    setPriceListMode(false)
    setPriceListFormOpen(false)
    setActiveSpecialOrder(null)
    setSpecialOrderFormIndex(null)
    setRecalculateFormIndex(null)
    triggerSmoothScrollFollow()
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content:
          'Add a kitchen photo and pick the stones you would like to see installed.',
      },
    ])
  }, [removeAiDesignImage, triggerSmoothScrollFollow])

  const addAiDesignStone = useCallback((stone: DesignStone) => {
    setAiDesignStones(prev => {
      if (prev.length >= 3) return prev
      if (prev.some(item => item.id === stone.id)) return prev
      return [...prev, stone]
    })
  }, [])

  const removeAiDesignStone = useCallback((id: number) => {
    setAiDesignStones(prev => prev.filter(item => item.id !== id))
  }, [])

  const toggleAiDesignSurface = useCallback((surface: AiDesignSurface) => {
    setAiDesignSurfaces(prev => {
      if (prev.includes(surface)) {
        const next = prev.filter(item => item !== surface)
        return next.length > 0 ? next : prev
      }
      return [...prev, surface]
    })
  }, [])

  const handlePriceListLookup = (event: React.FormEvent) => {
    event.preventDefault()
    const color = priceListColor.trim()
    const supplier = priceListSupplier.trim()
    if (!color || !supplier || isThinking) return
    setPriceListFormOpen(false)
    sendChatQuery(`Price for ${color} from ${supplier}`)
  }

  const handleAiDesignAttachClick = useCallback(() => {
    aiDesignImageInputRef.current?.click()
  }, [])

  const handleAiDesignFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      setAiDesignImageFromFile(file)
    },
    [setAiDesignImageFromFile],
  )

  const handleGenerateDesign = useCallback(async () => {
    const image = aiDesignImage
    if (
      !image ||
      aiDesignStones.length === 0 ||
      aiDesignSurfaces.length === 0 ||
      isGeneratingDesign ||
      isThinking
    ) {
      return
    }

    const stoneNames = aiDesignStones.map(stone => stone.name).join(', ')
    const surfaceText = formatAiDesignSurfaces(aiDesignSurfaces)
    const extraInstructions = aiDesignExtraInstructions.trim()
    setAiDesignFormOpen(false)
    addMessage({
      role: 'user',
      content: extraInstructions
        ? `Install ${stoneNames} on the ${surfaceText} in this kitchen. ${extraInstructions}`
        : `Install ${stoneNames} on the ${surfaceText} in this kitchen.`,
      images: [image.previewUrl],
    })
    setIsGeneratingDesign(true)
    setIsThinking(true)
    triggerSmoothScrollFollow()

    try {
      const formData = new FormData()
      formData.append('kitchen', image.file)
      formData.append('stoneIds', aiDesignStones.map(stone => stone.id).join(','))
      formData.append('surfaces', aiDesignSurfaces.join(','))
      if (extraInstructions) {
        formData.append('instructions', extraInstructions)
      }
      const response = await fetch('/api/ai-design', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const data: { error?: string } = await response.json()
        throw new Error(data.error ?? 'generation-failed')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('generation-failed')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let receivedDesign = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          const event: {
            type: string
            stoneName?: string
            image?: string
            error?: string
          } = JSON.parse(line)

          if (event.type === 'design' && event.image && event.stoneName) {
            receivedDesign = true
            addMessage({
              role: 'assistant',
              content: `Here is your kitchen with ${event.stoneName} installed.`,
              images: [event.image],
            })
            triggerSmoothScrollFollow()
          } else if (event.type === 'error') {
            throw new Error(event.error ?? 'generation-failed')
          }
        }
      }

      if (!receivedDesign) {
        throw new Error('generation-failed')
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message && error.message !== 'generation-failed'
          ? error.message
          : 'Sorry, I could not generate the design. Please try again.'
      addMessage({ role: 'assistant', content: message })
    } finally {
      setIsGeneratingDesign(false)
      setIsThinking(false)
    }
  }, [
    aiDesignImage,
    aiDesignStones,
    aiDesignSurfaces,
    aiDesignExtraInstructions,
    isGeneratingDesign,
    isThinking,
    triggerSmoothScrollFollow,
  ])

  useEffect(() => {
    if (!aiDesignFormOpen) return
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            setAiDesignImageFromFile(file)
            event.preventDefault()
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [aiDesignFormOpen, setAiDesignImageFromFile])

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    sendChatQuery(input.trim())
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

  const chatMessagesList =
    clearingSnapshot !== null ? clearingSnapshot : displayMessages

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
          <div className='h-full w-full bg-white border-l border-gray-300 shadow-lg flex flex-col overflow-hidden'>
            <DialogFullHeader
              actions={
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-sm font-medium text-gray-600 hover:text-gray-900'
                  onClick={handleClearChat}
                  disabled={
                    isClearingChat ||
                    (messages.length === 0 && !isThinking && answer.length === 0)
                  }
                  aria-label='Clear chat'
                >
                  Clear chat
                </Button>
              }
            >
              <span className='text-lg font-bold'>Chat</span>
            </DialogFullHeader>
            <div className='flex flex-col flex-1 min-h-0'>
              <ChatMessages
                messages={chatMessagesList}
                isThinking={isThinking && !answer}
                onImageClick={openInstructionImage}
                instructionsPath={instructionsPath}
                status={priceListStatus}
                specialOrderFormIndex={specialOrderFormIndex}
                recalculateFormIndex={recalculateFormIndex}
                onSpecialOrderYes={handleSpecialOrderYes}
                onSpecialOrderCalculate={handleSpecialOrderCalculate}
                onRecalculate={handleRecalculate}
                pendingQuoteSkeletonIndex={pendingQuoteSkeletonIndex}
                dismissingQuoteSkeletonIndex={dismissingQuoteSkeletonIndex}
                onQuoteSkeletonExitComplete={handleQuoteSkeletonExitComplete}
                isClearingChat={isClearingChat}
                clearStaggerTotal={clearStaggerTotal}
                onClearAnimationComplete={handleClearAnimationComplete}
                isCreatingImage={isGeneratingDesign}
                scrollRef={messagesScrollRef}
                contentRef={messagesContentRef}
              />
            </div>
            <div className='shrink-0 border-t border-gray-300 bg-gray-100'>
              <AnimatedPriceListMenu
                open={priceListFormOpen}
                color={priceListColor}
                onColorChange={setPriceListColor}
                supplier={priceListSupplier}
                onSupplierChange={setPriceListSupplier}
                isThinking={isThinking}
                onClose={closePriceListMode}
                onSubmit={handlePriceListLookup}
                onStop={stopResponse}
              />
              <AnimatedAiDesignMenu
                open={aiDesignFormOpen}
                image={aiDesignImage}
                stones={aiDesignStones}
                surfaces={aiDesignSurfaces}
                extraInstructions={aiDesignExtraInstructions}
                isGenerating={isGeneratingDesign}
                onAttachClick={handleAiDesignAttachClick}
                onImageDrop={setAiDesignImageFromFile}
                onRemoveImage={removeAiDesignImage}
                onAddStone={addAiDesignStone}
                onRemoveStone={removeAiDesignStone}
                onToggleSurface={toggleAiDesignSurface}
                onExtraInstructionsChange={setAiDesignExtraInstructions}
                onClose={closeAiDesignMode}
                onGenerate={handleGenerateDesign}
              />
              <input
                ref={aiDesignImageInputRef}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={handleAiDesignFileChange}
              />
              <AnimatedExpandPanel
                open={!priceListFormOpen && !aiDesignFormOpen}
                measureKey={isThinking}
              >
                <form onSubmit={handleFormSubmit} className='flex flex-col gap-2 p-4'>
                  <div className='flex items-center gap-2'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          className='shrink-0 rounded-full'
                          disabled={isThinking || isClearingChat}
                          aria-label='Open chat tools'
                        >
                          <Plus className='size-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='start' side='top'>
                        <DropdownMenuItem onClick={enablePriceListMode}>
                          Price lists
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={enableAiDesignMode}>
                          <Sparkles className='size-4' />
                          AI Design
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
                      disabled={isClearingChat}
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
                        disabled={input.trim().length === 0 || isClearingChat}
                        variant='blue'
                        type='submit'
                        className='rounded-full shrink-0'
                      >
                        Send
                      </Button>
                    )}
                  </div>
                </form>
              </AnimatedExpandPanel>
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
