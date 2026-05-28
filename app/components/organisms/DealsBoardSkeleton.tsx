import { Skeleton } from '~/components/ui/skeleton'

const COLUMN_CARD_COUNTS = [7, 6, 8, 5]

function DealCardSkeleton() {
  return (
    <div className='w-full rounded-lg border p-6 space-y-4'>
      <Skeleton className='h-10 w-4/5' />
      <Skeleton className='h-8 w-1/2' />
    </div>
  )
}

export function DealsBoardSkeleton() {
  const columns = Array.from({ length: 4 })

  return (
    <div className='flex min-h-0 flex-1 max-w-full min-w-0 items-stretch gap-1 md:min-w-0 max-md:h-full max-md:gap-0 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:snap-x max-md:snap-mandatory'>
      {columns.map((_, colIdx) => (
        <div
          key={colIdx}
          className='box-border flex min-w-93 flex-1 items-start justify-start px-2 max-md:w-full max-md:shrink-0 max-md:snap-start max-md:snap-always md:min-w-65 md:flex-1 md:flex-col md:px-0 xl:max-w-120'
        >
          <div className='flex w-full flex-col rounded-xl border overflow-hidden'>
            <Skeleton className='h-10 w-full rounded-none' />
            <div className='space-y-6 p-2'>
              {Array.from({ length: COLUMN_CARD_COUNTS[colIdx] ?? 6 }).map(
                (_, cardIdx) => (
                  <DealCardSkeleton key={cardIdx} />
                ),
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
