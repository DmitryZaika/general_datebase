import { format } from 'date-fns'
import { ArrowDown, ArrowLeft, ChevronUp, Link as LinkIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useLocation } from 'react-router'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Skeleton } from '~/components/ui/skeleton'
import { formatPhoneForDisplay } from '~/utils/phone'
import { formatDayLabel } from './dayLabel'
import { SmsBubble } from './SmsBubble'
import { SmsComposer } from './SmsComposer'
import { ConversationMessagesSkeleton } from './SmsPageEmptyStates'
import { buildSmsReactionMessage } from './smsReactionText'
import type { SmsMessage, SmsThread } from './types'

export interface SmsConversationPaneProps {
  phoneDigits: string
  thread: SmsThread | null
  pendingMessages: SmsMessage[]
  canSend: boolean
  isLoading: boolean
  isSending: boolean
  hasOlder: boolean
  isFetchingOlder: boolean
  onSend: (text: string) => void
  onRetry: (messageId: string) => void
  onLinkCustomer: () => void
  onLoadOlder: () => void
  readOnly?: boolean
}

interface DayGroup {
  dayKey: string
  dayLabel: string
  messages: SmsMessage[]
}

function groupByDay(messages: SmsMessage[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const msg of messages) {
    const date = new Date(msg.createdAt)
    const dayKey = format(date, 'yyyy-MM-dd')
    const last = groups[groups.length - 1]
    if (last && last.dayKey === dayKey) {
      last.messages.push(msg)
    } else {
      groups.push({ dayKey, dayLabel: formatDayLabel(date), messages: [msg] })
    }
  }
  return groups
}

const SCROLL_BOTTOM_THRESHOLD = 80 // px

export function SmsConversationPane(props: SmsConversationPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [newSinceScroll, setNewSinceScroll] = useState(0)
  const messageCountRef = useRef(0)
  const wasLoadingRef = useRef(false)
  const location = useLocation()
  // Mobile-only "back to list" target; on desktop the list stays visible beside us.
  const backHref = location.pathname.startsWith('/admin')
    ? '/admin/cloudtalk'
    : '/employee/cloudtalk'

  const allMessages = useMemo(() => {
    if (!props.thread) return []
    return [...props.thread.messages, ...props.pendingMessages]
  }, [props.thread, props.pendingMessages])

  const dayGroups = useMemo(() => groupByDay(allMessages), [allMessages])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    const near = dist <= SCROLL_BOTTOM_THRESHOLD
    setIsAtBottom(near)
    if (near) setNewSinceScroll(0)
  }, [])

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        setIsAtBottom(true)
        setNewSinceScroll(0)
      }
    })
  }, [])

  useEffect(() => {
    scrollToLatest()
  }, [props.phoneDigits, scrollToLatest])

  useEffect(() => {
    if (wasLoadingRef.current && !props.isLoading && props.thread) {
      scrollToLatest()
    }
    wasLoadingRef.current = props.isLoading
  }, [props.isLoading, props.thread, scrollToLatest])

  useEffect(() => {
    const prev = messageCountRef.current
    const next = allMessages.length
    messageCountRef.current = next
    if (next > prev) {
      const added = next - prev
      if (isAtBottom) {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        })
      } else {
        setNewSinceScroll(c => c + added)
      }
    }
  }, [allMessages.length, isAtBottom])

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
    setNewSinceScroll(0)
  }, [])

  const readOnly = Boolean(props.readOnly)
  const canInteract = props.canSend && !readOnly

  const showMessagesSkeleton = props.isLoading

  if (showMessagesSkeleton) {
    return (
      <div className='flex flex-col h-full min-h-0 bg-white'>
        <div className='border-b border-slate-200 px-4 py-3 flex items-center gap-2 shrink-0'>
          <RouterLink
            to={backHref}
            aria-label='Back to SMS conversations'
            className='md:hidden -ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100'
          >
            <ArrowLeft size={20} />
          </RouterLink>
          <div className='flex flex-col gap-1.5 min-w-0'>
            <Skeleton className='h-4 w-36 rounded' />
            <Skeleton className='h-3 w-28 rounded' />
          </div>
        </div>
        <ConversationMessagesSkeleton />
        {readOnly ? (
          <div className='border-t border-slate-200 bg-white px-4 py-3 shrink-0'>
            <Skeleton className='h-3 w-56 mx-auto rounded' />
          </div>
        ) : (
          <div className='border-t border-slate-200 p-3 flex items-center gap-2 shrink-0'>
            <Skeleton className='h-11 flex-1 rounded-full' />
            <Skeleton className='size-11 rounded-full shrink-0' />
          </div>
        )}
      </div>
    )
  }

  if (!props.thread) return null

  const customer = props.thread.customer
  const isUnlinked = !customer

  return (
    <div className='flex flex-col h-full bg-white'>
      <div className='border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2'>
        <div className='flex items-center gap-1 min-w-0'>
          <RouterLink
            to={backHref}
            aria-label='Back to SMS conversations'
            className='md:hidden -ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100'
          >
            <ArrowLeft size={20} />
          </RouterLink>
          <div className='min-w-0'>
            <div className='font-medium text-slate-900 truncate flex items-center gap-2'>
              {customer ? (
                <RouterLink
                  to={`/employee/customers/info/${customer.id}/info`}
                  className='hover:underline'
                >
                  {customer.name}
                </RouterLink>
              ) : (
                <>
                  <span>{formatPhoneForDisplay(props.phoneDigits)}</span>
                  <span className='inline-block text-[10px] uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5'>
                    Unlinked
                  </span>
                </>
              )}
            </div>
            {customer && (
              <div className='text-xs text-slate-500'>
                {formatPhoneForDisplay(props.phoneDigits)}
              </div>
            )}
          </div>
        </div>
        {isUnlinked && !readOnly && (
          <button
            type='button'
            onClick={props.onLinkCustomer}
            className='text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0'
          >
            <LinkIcon size={12} />
            Link to customer
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className='flex-1 overflow-y-auto px-4 py-3 space-y-3'
      >
        {props.hasOlder && (
          <div className='flex justify-center'>
            <LoadingButton
              type='button'
              variant='ghost'
              size='sm'
              loading={props.isFetchingOlder}
              onClick={props.onLoadOlder}
              className='text-xs'
            >
              <ChevronUp size={12} className='mr-1' />
              Load older messages
            </LoadingButton>
          </div>
        )}
        {dayGroups.map(group => (
          <div key={group.dayKey} className='space-y-1.5'>
            <div className='text-[11px] text-slate-400 text-center py-1'>
              — {group.dayLabel} —
            </div>
            {group.messages.map(msg => (
              <SmsBubble
                key={msg.id}
                message={msg}
                onRetry={
                  msg.status === 'failed' ? () => props.onRetry(msg.id) : undefined
                }
                canReact={canInteract}
                isReacting={props.isSending}
                onReact={
                  canInteract
                    ? (emoji, reactedToText) =>
                        props.onSend(buildSmsReactionMessage(emoji, reactedToText))
                    : undefined
                }
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className='relative'>
        {!isAtBottom && (
          <button
            type='button'
            onClick={scrollToBottom}
            className='absolute -top-12 right-6 inline-flex items-center gap-1.5 rounded-full bg-blue-500 text-white text-xs px-3 py-1.5 shadow-md hover:bg-blue-600 transition-colors'
          >
            <ArrowDown size={12} />
            {newSinceScroll > 0
              ? `${newSinceScroll} new message${newSinceScroll === 1 ? '' : 's'}`
              : 'Jump to latest'}
          </button>
        )}
        <SmsComposer
          phoneDigits={props.phoneDigits}
          canSend={canInteract}
          readOnly={readOnly}
          isSending={props.isSending}
          onSubmit={props.onSend}
        />
      </div>
    </div>
  )
}
