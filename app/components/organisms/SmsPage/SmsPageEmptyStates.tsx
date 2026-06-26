import { AlertTriangle, MessageSquare, Search } from 'lucide-react'
import { Skeleton } from '~/components/ui/skeleton'
import { cn } from '~/lib/utils'

export function NoThreadsEmpty() {
  return (
    <div className='flex flex-col items-center justify-center h-full text-center px-6'>
      <MessageSquare size={36} className='text-slate-300 mb-3' />
      <p className='text-sm font-medium text-slate-700'>No SMS conversations yet</p>
      <p className='text-xs text-slate-500 mt-1 max-w-xs'>
        Inbound and outbound CloudTalk messages will appear here as they happen.
      </p>
    </div>
  )
}

export function SearchNoMatch({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <div className='flex flex-col items-center justify-center text-center px-6 py-10'>
      <Search size={28} className='text-slate-300 mb-2' />
      <p className='text-sm text-slate-700'>
        No conversations match &ldquo;{query}&rdquo;
      </p>
      <button
        type='button'
        onClick={onClear}
        className='text-xs text-blue-600 hover:underline mt-2'
      >
        Clear search
      </button>
    </div>
  )
}

export function NoThreadSelected() {
  return (
    <div className='flex flex-col items-center justify-center h-full text-center px-6'>
      <MessageSquare size={36} className='text-slate-300 mb-3' />
      <p className='text-sm font-medium text-slate-700'>Select a conversation</p>
      <p className='text-xs text-slate-500 mt-1 max-w-xs'>
        Choose a thread on the left to read messages and reply.
      </p>
    </div>
  )
}

export function AgentNotLinkedBanner() {
  return (
    <div className='bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-xs flex items-center gap-2'>
      <AlertTriangle size={14} />
      <span>
        Your account isn&apos;t linked to a CloudTalk agent yet — you can read SMS but
        not send. Ask an admin to link your account in user settings.
      </span>
    </div>
  )
}

// Mirrors a real conversation: alternating inbound (left) / outbound (right)
// bubbles, matching SmsBubble's rounded-2xl shape and blue outbound tint.
const THREAD_SKELETON_BUBBLES = [
  { id: 'm1', side: 'in', width: 'w-1/2', height: 'h-8' },
  { id: 'm2', side: 'out', width: 'w-3/5', height: 'h-12' },
  { id: 'm3', side: 'in', width: 'w-2/5', height: 'h-8' },
  { id: 'm4', side: 'out', width: 'w-2/5', height: 'h-8' },
  { id: 'm5', side: 'in', width: 'w-3/5', height: 'h-12' },
  { id: 'm6', side: 'out', width: 'w-1/3', height: 'h-8' },
] as const

// Mirrors SmsThreadListItem: title + timestamp on top, direction icon +
// message preview below, separated by the same border.
const LIST_SKELETON_ROWS = [
  { id: 'l1', title: 'w-2/5', preview: 'w-3/4' },
  { id: 'l2', title: 'w-1/3', preview: 'w-2/3' },
  { id: 'l3', title: 'w-1/2', preview: 'w-5/6' },
  { id: 'l4', title: 'w-2/5', preview: 'w-1/2' },
  { id: 'l5', title: 'w-1/3', preview: 'w-3/4' },
  { id: 'l6', title: 'w-1/2', preview: 'w-2/3' },
] as const

export function ConversationMessagesSkeleton() {
  return (
    <div className='flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3'>
      <div className='flex justify-center py-1'>
        <Skeleton className='h-2.5 w-20 rounded' />
      </div>
      {THREAD_SKELETON_BUBBLES.slice(0, 4).map(b => (
        <div
          key={b.id}
          className={cn('flex', b.side === 'out' ? 'justify-end' : 'justify-start')}
        >
          <Skeleton
            className={cn(
              'rounded-2xl max-w-[85%]',
              b.width,
              b.height,
              b.side === 'out' && 'bg-blue-100',
            )}
          />
        </div>
      ))}
      <div className='flex justify-center py-1'>
        <Skeleton className='h-2.5 w-16 rounded' />
      </div>
      {THREAD_SKELETON_BUBBLES.slice(4).map(b => (
        <div
          key={b.id}
          className={cn('flex', b.side === 'out' ? 'justify-end' : 'justify-start')}
        >
          <Skeleton
            className={cn(
              'rounded-2xl max-w-[85%]',
              b.width,
              b.height,
              b.side === 'out' && 'bg-blue-100',
            )}
          />
        </div>
      ))}
    </div>
  )
}

export function ThreadLoading() {
  return <ConversationMessagesSkeleton />
}

export function ThreadListLoading() {
  return (
    <div>
      {LIST_SKELETON_ROWS.map(row => (
        <div
          key={row.id}
          className='px-4 py-3 border-b border-slate-100 flex flex-col gap-1.5'
        >
          <div className='flex items-center justify-between gap-2'>
            <Skeleton className={cn('h-3.5 rounded', row.title)} />
            <Skeleton className='h-2.5 w-20 rounded shrink-0' />
          </div>
          <div className='flex items-center gap-1.5'>
            <Skeleton className='size-3 rounded-full shrink-0' />
            <Skeleton className={cn('h-3 rounded', row.preview)} />
          </div>
        </div>
      ))}
    </div>
  )
}
