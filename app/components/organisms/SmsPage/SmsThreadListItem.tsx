import { formatDistanceToNowStrict } from 'date-fns'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '~/lib/utils'
import { formatPhoneForDisplay } from '~/utils/phone'
import type { ThreadSummary } from './types'

export interface SmsThreadListItemProps {
  thread: ThreadSummary
  isActive: boolean
  onClick: () => void
}

export function SmsThreadListItem({
  thread,
  isActive,
  onClick,
}: SmsThreadListItemProps) {
  const isUnlinked = !thread.customerName
  const title = thread.customerName ?? formatPhoneForDisplay(thread.phoneDigits)
  const isUnread = thread.unreadCount > 0
  const isInbound = thread.lastDirection === 'inbound'

  return (
    <button
      type='button'
      id={`sms-thread-${thread.phoneDigits}`}
      role='option'
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-slate-100 flex flex-col gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300',
        isActive ? 'bg-blue-50' : 'hover:bg-slate-50',
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <span
          className={cn(
            'truncate text-sm',
            isUnread ? 'font-semibold text-slate-900' : 'text-slate-800',
          )}
        >
          {title}
          {isUnlinked && (
            <span className='ml-2 inline-block text-[10px] uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5'>
              Unlinked
            </span>
          )}
        </span>
        <span
          className={cn(
            'text-[11px] shrink-0',
            isUnread ? 'text-blue-600 font-medium' : 'text-slate-400',
          )}
        >
          {formatDistanceToNowStrict(new Date(thread.lastMessageAt))} ago
        </span>
      </div>
      <div className='flex items-center gap-1.5 min-w-0'>
        {isInbound ? (
          <ArrowDown
            size={12}
            className='text-slate-400 shrink-0'
            aria-label='Incoming'
          />
        ) : (
          <ArrowUp
            size={12}
            className='text-slate-400 shrink-0'
            aria-label='Outgoing'
          />
        )}
        <span
          className={cn(
            'text-xs truncate italic flex-1 min-w-0',
            isUnread ? 'text-slate-700' : 'text-slate-500',
          )}
        >
          {thread.lastMessageText}
        </span>
        {isUnread && (
          <span
            className='inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-semibold text-white shrink-0'
            aria-label={`${thread.unreadCount} unread`}
          >
            {thread.unreadCount}
          </span>
        )}
      </div>
    </button>
  )
}
