import { DealEditDialogClose } from '~/components/molecules/DealEditDialogClose'
import { Skeleton } from '~/components/ui/skeleton'

export function DealEditDialogSkeleton() {
  return (
    <div className='flex min-h-[600px] flex-col gap-4' aria-hidden>
      <div className='flex items-center justify-between gap-3 px-1 sm:px-2'>
        <Skeleton className='h-8 w-48' />
        <DealEditDialogClose />
      </div>
      <Skeleton className='h-12 w-full' />
      <div className='grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='space-y-3'>
          <Skeleton className='h-9 w-full max-w-md' />
          <Skeleton className='h-9 w-full max-w-lg' />
          <Skeleton className='h-36 w-full' />
          <Skeleton className='h-9 w-2/3 max-w-md' />
        </div>
        <div className='space-y-3 border-t pt-4 md:border-l md:border-t-0 md:pt-0 md:pl-4'>
          <Skeleton className='h-9 w-full max-w-xs' />
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-16 w-full' />
        </div>
      </div>
    </div>
  )
}
