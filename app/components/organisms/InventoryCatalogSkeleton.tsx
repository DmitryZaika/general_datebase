import { Skeleton } from '~/components/ui/skeleton'

const GRID_CLASS =
  'grid grid-cols-2 gap-2 px-2 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7'

const TITLE_WIDTHS = ['w-3/4', 'w-5/6', 'w-2/3', 'w-4/5', 'w-3/5', 'w-11/12']

function InventoryToolbarSkeleton() {
  return (
    <div className='mb-2 flex flex-wrap items-end justify-between'>
      <div className='flex items-center gap-4'>
        <Skeleton className='ml-2 h-9 w-28 rounded-md' />
        <Skeleton className='h-9 w-24 rounded-md' />
      </div>
      <div className='flex flex-1 justify-center md:ml-auto md:justify-end'>
        <Skeleton className='h-9 w-full max-w-sm rounded-md' />
      </div>
    </div>
  )
}

function InventoryCardSkeleton({ fieldLineCount }: { fieldLineCount: number }) {
  return (
    <div className='w-full overflow-hidden rounded-lg border bg-white shadow-sm'>
      <Skeleton className='h-40 w-full rounded-none' />
      <div className='space-y-1.5 p-2'>
        <Skeleton className='mx-auto h-4 w-3/4' />
        {Array.from({ length: fieldLineCount }).map((_, idx) => (
          <Skeleton
            key={idx}
            className={`h-3 ${TITLE_WIDTHS[idx % TITLE_WIDTHS.length]}`}
          />
        ))}
      </div>
    </div>
  )
}

export function InventoryGridCardsSkeleton({
  fieldLineCount = 3,
  cardCount = 14,
}: {
  fieldLineCount?: number
  cardCount?: number
}) {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: cardCount }).map((_, idx) => (
        <InventoryCardSkeleton key={idx} fieldLineCount={fieldLineCount} />
      ))}
    </div>
  )
}

export function InventoryCatalogSkeleton({
  showToolbar = false,
  fieldLineCount = 3,
}: {
  showToolbar?: boolean
  fieldLineCount?: number
}) {
  return (
    <div className='flex flex-col'>
      {showToolbar ? <InventoryToolbarSkeleton /> : null}
      <InventoryCatalogContentSkeleton fieldLineCount={fieldLineCount} />
    </div>
  )
}

export function InventoryCatalogContentSkeleton({
  fieldLineCount = 3,
}: {
  fieldLineCount?: number
}) {
  return <InventoryGridCardsSkeleton fieldLineCount={fieldLineCount} />
}
