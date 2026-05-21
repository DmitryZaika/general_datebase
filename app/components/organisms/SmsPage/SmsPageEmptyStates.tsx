import { AlertTriangle, MessageSquare, Search } from 'lucide-react'
import { Skeleton } from '~/components/ui/skeleton'

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

const THREAD_SKELETON_KEYS = ['t1', 't2', 't3', 't4', 't5']
const LIST_SKELETON_KEYS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']

export function ThreadLoading() {
  return (
    <div className='flex-1 px-4 py-6 space-y-3'>
      {THREAD_SKELETON_KEYS.map(k => (
        <Skeleton key={k} className='h-8 w-2/3 rounded-2xl' />
      ))}
    </div>
  )
}

export function ThreadListLoading() {
  return (
    <div className='divide-y divide-slate-100'>
      {LIST_SKELETON_KEYS.map(k => (
        <div key={k} className='px-4 py-3 space-y-2'>
          <div className='flex justify-between'>
            <Skeleton className='h-3 w-1/2' />
            <Skeleton className='h-3 w-12' />
          </div>
          <Skeleton className='h-3 w-5/6' />
        </div>
      ))}
    </div>
  )
}
