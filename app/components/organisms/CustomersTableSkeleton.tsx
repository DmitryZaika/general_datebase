import { Skeleton } from '~/components/ui/skeleton'

export function CustomersTableSkeleton() {
  const rows = Array.from({ length: 8 })
  return (
    <div className='rounded-md border'>
      <div className='grid grid-cols-6 gap-4 p-3 border-b'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-4 w-40' />
        <Skeleton className='h-4 w-64' />
        <Skeleton className='h-4 w-24' />
        <Skeleton className='h-4 w-10' />
      </div>
      {rows.map((_, idx) => (
        <div key={idx} className='grid grid-cols-6 gap-4 p-3 border-b'>
          <Skeleton className='h-4 w-40' />
          <Skeleton className='h-4 w-28' />
          <Skeleton className='h-4 w-56' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-8 w-10 rounded' />
        </div>
      ))}
    </div>
  )
}
