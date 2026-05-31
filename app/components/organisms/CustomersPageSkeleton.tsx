import { Building2, Layers, Plus, Search, Users } from 'lucide-react'
import { Skeleton } from '~/components/ui/skeleton'

const NAME_WIDTHS = ['w-36', 'w-44', 'w-40', 'w-32', 'w-48', 'w-36', 'w-44', 'w-40']
const PHONE_WIDTHS = ['w-28', 'w-32', 'w-24', 'w-36', 'w-28', 'w-32', 'w-24', 'w-28']
const EMAIL_WIDTHS = ['w-48', 'w-56', 'w-44', 'w-52', 'w-40', 'w-56', 'w-48', 'w-44']
const REP_WIDTHS = ['w-24', 'w-28', 'w-32', 'w-24', 'w-28', 'w-32', 'w-24', 'w-28']
const DATE_WIDTHS = ['w-20', 'w-24', 'w-20', 'w-24', 'w-20', 'w-24', 'w-20', 'w-24']

function CustomersToolbarSkeleton() {
  return (
    <div className='flex flex-col items-center justify-between md:flex-row'>
      <div className='flex flex-wrap items-center gap-4'>
        <div className='flex h-9 w-[110px] items-center gap-2 rounded-md border bg-white px-3 md:w-[180px]'>
          <Layers className='h-4 w-4 shrink-0 text-zinc-400' />
          <Skeleton className='h-4 flex-1' />
        </div>
        <div className='flex h-9 w-[100px] items-center gap-2 rounded-md border bg-white px-3 md:w-[180px]'>
          <Users className='h-4 w-4 shrink-0 text-zinc-400' />
          <Skeleton className='h-4 flex-1' />
        </div>
        <div className='flex h-9 w-[110px] items-center gap-2 rounded-md border bg-white px-3 md:w-[180px]'>
          <Building2 className='h-4 w-4 shrink-0 text-zinc-400' />
          <Skeleton className='h-4 flex-1' />
        </div>
      </div>
      <div className='relative mt-2 w-full min-w-0 max-w-sm md:mt-0'>
        <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-zinc-300' />
        <Skeleton className='h-9 w-full rounded-md pl-9' />
      </div>
    </div>
  )
}

function CustomersAddButtonSkeleton() {
  return (
    <div className='flex h-9 w-fit items-center gap-2 rounded-md border px-3'>
      <Plus className='h-4 w-4 shrink-0 text-zinc-400' />
      <Skeleton className='h-4 w-24' />
    </div>
  )
}

export function CustomersPaginationSkeleton() {
  return (
    <div className='flex items-center justify-between px-2 py-4'>
      <Skeleton className='h-4 w-28' />
      <div className='flex items-center space-x-6 lg:space-x-8'>
        <div className='flex items-center space-x-2'>
          <Skeleton className='hidden h-4 w-24 md:block' />
          <Skeleton className='h-8 w-[70px] rounded-md' />
        </div>
        <Skeleton className='h-4 w-24' />
        <div className='flex items-center space-x-2'>
          <Skeleton className='h-8 w-8 rounded-md' />
          <Skeleton className='h-8 w-8 rounded-md' />
          <Skeleton className='h-8 w-8 rounded-md' />
          <Skeleton className='h-8 w-8 rounded-md' />
        </div>
      </div>
    </div>
  )
}

export function CustomersTableSkeleton({ rowCount = 10 }: { rowCount?: number }) {
  return (
    <div className='rounded-md border'>
      <div className='grid grid-cols-6 gap-4 border-b p-3'>
        <Skeleton className='h-8 w-32' />
        <Skeleton className='h-8 w-28' />
        <Skeleton className='h-8 w-16' />
        <Skeleton className='h-8 w-24' />
        <Skeleton className='h-8 w-14' />
        <Skeleton className='h-8 w-10' />
      </div>
      {Array.from({ length: rowCount }).map((_, idx) => (
        <div key={idx} className='grid grid-cols-6 gap-4 border-b p-3 last:border-b-0'>
          <Skeleton className={`h-4 ${NAME_WIDTHS[idx % NAME_WIDTHS.length]}`} />
          <Skeleton className={`h-4 ${PHONE_WIDTHS[idx % PHONE_WIDTHS.length]}`} />
          <Skeleton className={`h-4 ${EMAIL_WIDTHS[idx % EMAIL_WIDTHS.length]}`} />
          <Skeleton
            className={`h-8 ${REP_WIDTHS[idx % REP_WIDTHS.length]} rounded-md`}
          />
          <Skeleton className={`h-4 ${DATE_WIDTHS[idx % DATE_WIDTHS.length]}`} />
          <Skeleton className='h-8 w-10 rounded-md' />
        </div>
      ))}
    </div>
  )
}

export function CustomersPageSkeleton() {
  return (
    <div className='flex-1 p-2 sm:p-5'>
      <Skeleton className='mx-auto mb-8 h-9 w-44 sm:mx-0' />
      <section className='flex flex-col gap-3'>
        <CustomersToolbarSkeleton />
        <CustomersAddButtonSkeleton />
        <CustomersPaginationSkeleton />
        <CustomersTableSkeleton />
        <CustomersPaginationSkeleton />
      </section>
    </div>
  )
}
