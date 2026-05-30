import { Inbox, PenSquare, RotateCw, Search, Send, Trash2 } from 'lucide-react'
import { Skeleton } from '~/components/ui/skeleton'

const SENDER_WIDTHS = ['w-36', 'w-44', 'w-40', 'w-48', 'w-32', 'w-40', 'w-36', 'w-44']
const SUBJECT_WIDTHS = ['w-32', 'w-40', 'w-28', 'w-36', 'w-44', 'w-24', 'w-36', 'w-32']
const SNIPPET_WIDTHS = [
  'w-full',
  'w-5/6',
  'w-4/5',
  'w-full',
  'w-3/4',
  'w-5/6',
  'w-full',
  'w-4/5',
]

function EmailsSidebarSkeleton({ adminMode = false }: { adminMode?: boolean }) {
  return (
    <div className='flex h-full flex-col py-4 pr-4'>
      {adminMode ? (
        <Skeleton className='h-9 w-full rounded-md' />
      ) : (
        <div className='flex h-9 w-full items-center justify-center gap-2 rounded-md bg-black px-4'>
          <PenSquare className='h-4 w-4 shrink-0 text-white/40' />
          <Skeleton className='h-4 w-[4.5rem] rounded bg-white/25' />
        </div>
      )}
      <nav className='mt-4 flex-1 space-y-1 pr-2'>
        {[
          { icon: Inbox, active: true },
          { icon: Send, active: false },
          { icon: Trash2, active: false },
        ].map(({ icon: Icon, active }, idx) => (
          <div
            key={idx}
            className={`flex w-full items-center gap-3 rounded-r-full px-6 py-2 ${
              active ? 'bg-[#e8f0fe]' : ''
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${active ? 'text-[#1967d2]' : 'text-gray-400'}`}
            />
            <Skeleton className={`h-4 flex-1 ${active ? 'max-w-16' : 'max-w-14'}`} />
            {active ? <Skeleton className='h-3 w-5 rounded-full' /> : null}
          </div>
        ))}
      </nav>
    </div>
  )
}

function EmailsToolbarSkeleton() {
  return (
    <div className='flex flex-col gap-2 border-b border-gray-200 bg-white px-2 py-2 md:flex-row md:items-stretch md:gap-4 md:px-3 md:py-3'>
      <div className='flex w-full min-w-0 items-stretch gap-2 md:min-h-0 md:flex-1'>
        <div className='flex min-w-0 flex-1 items-stretch gap-2 pl-2 md:flex-initial md:min-w-0'>
          <div className='flex shrink-0 items-center self-stretch'>
            <Skeleton className='size-4.5 rounded-[2px]' />
          </div>
        </div>
        <div className='relative ml-2 hidden min-w-0 max-w-md flex-1 self-center md:block'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-gray-300' />
          <Skeleton className='h-9 w-full rounded-md pl-9' />
        </div>
        <div className='ml-auto flex min-h-9 w-9 shrink-0 items-center justify-center self-center rounded-full md:ml-0 md:self-stretch'>
          <RotateCw className='h-4 w-4 text-gray-300' />
        </div>
      </div>
      <div className='relative w-full min-w-0 md:hidden'>
        <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-gray-300' />
        <Skeleton className='h-9 w-full rounded-md pl-9' />
      </div>
    </div>
  )
}

function EmailRowSkeleton({
  adminMode = false,
  rowIndex,
}: {
  adminMode?: boolean
  rowIndex: number
}) {
  const senderWidth = SENDER_WIDTHS[rowIndex % SENDER_WIDTHS.length]
  const subjectWidth = SUBJECT_WIDTHS[rowIndex % SUBJECT_WIDTHS.length]
  const snippetWidth = SNIPPET_WIDTHS[rowIndex % SNIPPET_WIDTHS.length]
  const showAttachment = rowIndex % 4 === 1 || rowIndex % 7 === 3

  return (
    <div className='group relative border-b border-transparent bg-white px-3 py-1.5'>
      <div className='relative z-[2] flex w-full min-w-0 items-stretch gap-3'>
        <div className='flex shrink-0 items-center self-stretch'>
          <Skeleton className='size-4.5 rounded-[2px]' />
        </div>

        <div className='flex min-w-0 flex-1 flex-col gap-0.5 md:hidden'>
          <div className='flex items-center justify-between gap-2'>
            <Skeleton className={`h-4 max-w-[65%] ${senderWidth}`} />
            <div className='flex flex-shrink-0 items-center gap-2'>
              {showAttachment ? <Skeleton className='h-3.5 w-3.5 rounded-sm' /> : null}
              <Skeleton className='h-3 w-10' />
            </div>
          </div>
          <Skeleton className={`h-4 max-w-[260px] ${subjectWidth}`} />
          <Skeleton className={`h-4 max-w-[220px] ${snippetWidth}`} />
        </div>

        <div className='hidden min-h-9 min-w-0 flex-1 items-center gap-4 md:flex'>
          {adminMode ? <Skeleton className='h-4 w-32 flex-shrink-0' /> : null}
          <Skeleton className={`h-4 flex-shrink-0 ${senderWidth}`} />
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            <Skeleton className={`h-4 max-w-[200px] flex-shrink-0 ${subjectWidth}`} />
            <Skeleton className='h-3 w-2 flex-shrink-0 rounded-full' />
            <Skeleton className={`h-4 min-w-0 flex-1 ${snippetWidth}`} />
          </div>
          <div className='flex w-24 flex-shrink-0 items-center justify-end gap-2'>
            {showAttachment ? <Skeleton className='h-3.5 w-3.5 rounded-sm' /> : null}
          </div>
          <Skeleton className='h-3.5 w-16 flex-shrink-0' />
        </div>
      </div>
    </div>
  )
}

export function EmailsListSkeleton({
  adminMode = false,
  rowCount = 12,
}: {
  adminMode?: boolean
  rowCount?: number
}) {
  return (
    <div className='divide-y divide-gray-100'>
      {Array.from({ length: rowCount }).map((_, i) => (
        <EmailRowSkeleton key={i} adminMode={adminMode} rowIndex={i} />
      ))}
    </div>
  )
}

export function EmailsPaginationSkeleton() {
  return (
    <div className='flex items-center justify-between gap-4 border-t border-gray-200 bg-gray-50 px-3 py-2'>
      <Skeleton className='h-8 w-20 rounded-md' />
      <Skeleton className='h-4 w-48' />
      <Skeleton className='h-8 w-16 rounded-md' />
    </div>
  )
}

export function EmailsMainPanelSkeleton({
  adminMode = false,
}: {
  adminMode?: boolean
}) {
  return (
    <div className='flex h-full flex-1 flex-col overflow-hidden border border-gray-200 bg-white shadow-sm md:mb-4 md:mr-4 md:rounded-tl-2xl'>
      <EmailsToolbarSkeleton />
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <EmailsListSkeleton adminMode={adminMode} />
      </div>
      <EmailsPaginationSkeleton />
    </div>
  )
}

export function EmailsPageSkeleton({ adminMode = false }: { adminMode?: boolean }) {
  return (
    <div className='relative flex h-[calc(100vh-100px)] w-full bg-background p-2 font-sans'>
      <div className='hidden w-64 flex-shrink-0 flex-col md:flex'>
        <EmailsSidebarSkeleton adminMode={adminMode} />
      </div>
      <EmailsMainPanelSkeleton adminMode={adminMode} />
    </div>
  )
}
