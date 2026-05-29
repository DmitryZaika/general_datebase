import { Skeleton } from '~/components/ui/skeleton'

export function EmailSendDialogSkeletonContent() {
  return (
    <div className='flex min-h-[500px] flex-col space-y-4'>
      <Skeleton className='h-7 w-32' />
      <div className='space-y-2'>
        <Skeleton className='h-4 w-8' />
        <Skeleton className='h-10 w-full rounded-md' />
      </div>
      <div className='space-y-2'>
        <Skeleton className='h-4 w-16' />
        <Skeleton className='h-10 w-full rounded-md' />
      </div>
      <div className='min-h-0 flex-1 space-y-2'>
        <Skeleton className='h-4 w-12' />
        <Skeleton className='h-48 w-full rounded-md' />
      </div>
      <div className='flex justify-end gap-2'>
        <Skeleton className='h-9 w-24 rounded-md' />
        <Skeleton className='h-9 w-9 rounded-md' />
      </div>
    </div>
  )
}
