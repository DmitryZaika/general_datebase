import { Skeleton } from '~/components/ui/skeleton'

export function EmailChatSkeletonContent() {
  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <div className='flex items-start gap-3 border-b p-2'>
        <Skeleton className='h-10 w-10 shrink-0 rounded-full' />
        <div className='min-w-0 flex-1 space-y-2'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='h-3 w-56' />
        </div>
      </div>
      <div className='min-h-0 flex-1 space-y-4 overflow-hidden p-4'>
        <Skeleton className='ml-auto h-16 w-3/5 rounded-lg' />
        <Skeleton className='h-20 w-4/5 rounded-lg' />
        <Skeleton className='ml-auto h-12 w-1/2 rounded-lg' />
        <Skeleton className='h-14 w-2/3 rounded-lg' />
      </div>
      <div className='space-y-2 border-t p-3'>
        <Skeleton className='h-24 w-full rounded-md' />
        <div className='flex justify-end gap-2'>
          <Skeleton className='h-9 w-9 rounded-md' />
          <Skeleton className='h-9 w-9 rounded-md' />
        </div>
      </div>
    </div>
  )
}
