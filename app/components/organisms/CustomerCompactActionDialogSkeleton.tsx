import { DialogHeader } from '~/components/ui/dialog'
import { Skeleton } from '~/components/ui/skeleton'

export function CustomerCompactActionDialogSkeletonContent() {
  return (
    <>
      <DialogHeader className='space-y-2'>
        <Skeleton className='h-6 w-44' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-4/5' />
      </DialogHeader>
      <div className='space-y-2 py-1'>
        <Skeleton className='h-4 w-16' />
        <Skeleton className='h-10 w-full rounded-md' />
      </div>
      <div className='flex justify-end gap-2 pt-2'>
        <Skeleton className='h-9 w-20 rounded-md' />
        <Skeleton className='h-9 w-24 rounded-md' />
      </div>
    </>
  )
}
