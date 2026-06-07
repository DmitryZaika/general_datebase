import { Search, SquarePen } from 'lucide-react'
import { Skeleton } from '~/components/ui/skeleton'
import {
  ConversationMessagesSkeleton,
  NoThreadSelected,
  ThreadListLoading,
} from './SmsPageEmptyStates'

export interface CloudTalkPageSkeletonProps {
  readOnly?: boolean
  showConversationOnMobile?: boolean
}

function CloudTalkSidebarSkeleton({ readOnly }: { readOnly: boolean }) {
  return (
    <div className='px-4 py-3 border-b border-slate-200'>
      <div className='flex items-center justify-between gap-2 mb-3'>
        <h2 className='text-base font-semibold text-slate-900'>CloudTalk SMS</h2>
        {!readOnly ? (
          <div
            className='inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/30'
            aria-hidden
          >
            <SquarePen size={18} strokeWidth={2} className='text-sky-600/40' />
          </div>
        ) : null}
      </div>
      <div className='relative'>
        <Search
          size={14}
          className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none'
        />
        <Skeleton className='h-9 w-full rounded-md' />
      </div>
    </div>
  )
}

function ConversationPaneSkeleton({ readOnly }: { readOnly: boolean }) {
  return (
    <>
      <div className='border-b border-slate-200 px-4 py-3 flex items-center gap-2 shrink-0'>
        <div className='flex flex-col gap-1.5 min-w-0'>
          <Skeleton className='h-4 w-36 rounded' />
          <Skeleton className='h-3 w-28 rounded' />
        </div>
      </div>
      <ConversationMessagesSkeleton />
      {readOnly ? (
        <div className='border-t border-slate-200 bg-white px-4 py-3 shrink-0'>
          <p className='text-center text-xs leading-snug text-slate-300'>
            View only — use employee CloudTalk SMS to reply
          </p>
        </div>
      ) : (
        <div className='border-t border-slate-200 p-3 shrink-0'>
          <div className='flex items-end gap-1.5'>
            <Skeleton className='h-11 flex-1 rounded-md' />
            <Skeleton className='size-11 rounded-md shrink-0' />
            <Skeleton className='size-11 rounded-md shrink-0' />
            <Skeleton className='h-11 w-20 rounded-md shrink-0' />
          </div>
        </div>
      )}
    </>
  )
}

export function CloudTalkPageSkeleton(props: CloudTalkPageSkeletonProps) {
  const readOnly = Boolean(props.readOnly)
  const showConversationOnMobile = Boolean(props.showConversationOnMobile)
  const showThreadPane = showConversationOnMobile

  return (
    <div className='flex flex-col h-[calc(100vh-100px)] w-full bg-slate-50'>
      {readOnly ? (
        <div className='bg-slate-100 border-b border-slate-200 text-slate-600 px-4 py-2 text-xs text-center'>
          View only — open employee CloudTalk SMS to send messages
        </div>
      ) : null}
      <div className='flex flex-1 min-h-0 w-full'>
        <aside
          className={`${
            showConversationOnMobile ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 border-r border-slate-200 bg-white flex-col h-full shrink-0`}
          aria-hidden
        >
          <CloudTalkSidebarSkeleton readOnly={readOnly} />
          <div className='flex-1 overflow-y-auto'>
            <ThreadListLoading />
          </div>
        </aside>
        <main
          className={`${
            showConversationOnMobile ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col bg-white min-h-0`}
        >
          {showThreadPane ? (
            <ConversationPaneSkeleton readOnly={readOnly} />
          ) : (
            <div className='flex-1 min-h-0 bg-white'>
              <NoThreadSelected />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
