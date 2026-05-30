import { Skeleton } from '~/components/ui/skeleton'

export function EmployeePageSkeleton() {
  return (
    <div className='p-2 sm:p-5'>
      <Skeleton className='mx-auto mb-8 h-9 w-48 sm:mx-0' />
      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex gap-2'>
            <Skeleton className='h-9 w-28' />
            <Skeleton className='h-9 w-24' />
          </div>
          <Skeleton className='h-9 w-full max-w-xs sm:max-w-sm' />
        </div>
        <Skeleton className='h-28 w-full rounded-lg' />
        <div className='rounded-md border'>
          <div className='grid grid-cols-4 gap-4 border-b p-3 max-sm:grid-cols-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='hidden h-4 w-28 sm:block' />
            <Skeleton className='hidden h-4 w-32 md:block' />
          </div>
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className='grid grid-cols-4 gap-4 border-b p-3 last:border-b-0 max-sm:grid-cols-2'
            >
              <Skeleton className='h-4 w-full max-w-32' />
              <Skeleton className='h-4 w-full max-w-24' />
              <Skeleton className='hidden h-4 w-full max-w-28 sm:block' />
              <Skeleton className='hidden h-4 w-full max-w-36 md:block' />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
