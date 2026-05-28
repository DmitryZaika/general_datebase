import { DialogHeader } from '~/components/ui/dialog'
import { Skeleton } from '~/components/ui/skeleton'

export function CustomerActionDialogSkeletonContent() {
  return (
    <>
      <DialogHeader>
        <Skeleton className='h-7 w-48' />
      </DialogHeader>
      <div className='mt-4 space-y-4'>
        <div className='border rounded p-4 space-y-3'>
          <Skeleton className='h-6 w-3/4' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-5/6' />
          <Skeleton className='h-4 w-2/3' />
          <Skeleton className='h-4 w-4/5' />
        </div>
        <div className='border rounded p-4 space-y-3'>
          <Skeleton className='h-5 w-24' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-4/5' />
          <Skeleton className='h-4 w-3/5' />
        </div>
        <div className='border rounded p-4 space-y-3'>
          <Skeleton className='h-5 w-20' />
          <Skeleton className='h-16 w-full' />
        </div>
        <Skeleton className='h-9 w-24' />
      </div>
    </>
  )
}
