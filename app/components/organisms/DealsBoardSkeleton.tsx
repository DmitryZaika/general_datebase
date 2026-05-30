import { Skeleton } from '~/components/ui/skeleton'

function DealsFiltersToolbarSkeleton() {
  return (
    <div className='mb-2 flex w-full flex-col items-center justify-between gap-2 px-1 py-1 sm:flex-row'>
      <div className='flex w-full items-center justify-center gap-2 sm:w-auto'>
        <div className='flex h-9 w-[150px] items-center rounded-md border px-3'>
          <Skeleton className='h-4 w-full' />
        </div>
        <div className='flex h-9 w-[150px] items-center rounded-md border px-3'>
          <Skeleton className='h-4 w-full' />
        </div>
        <div className='hidden h-9 items-center rounded-md border px-3 md:flex'>
          <Skeleton className='h-4 w-20' />
        </div>
      </div>
      <div className='flex h-9 w-full max-w-md items-center rounded-md border px-3 sm:w-auto sm:flex-1'>
        <Skeleton className='h-4 w-full' />
      </div>
    </div>
  )
}

function ListHeaderSkeleton() {
  return (
    <div className='flex items-center justify-between rounded-t-xl bg-black px-3 py-2'>
      <Skeleton className='h-4 w-28 rounded-md bg-white/25' />
      <Skeleton className='h-5 w-8 rounded-full bg-white/20' />
    </div>
  )
}

type DealCardSkeletonVariant = 'compact' | 'standard' | 'expanded'

const DEAL_CARD_VARIANTS: { height: number; variant: DealCardSkeletonVariant }[] = [
  { height: 130, variant: 'compact' },
  { height: 164, variant: 'standard' },
  { height: 170, variant: 'expanded' },
]

function DealCardSkeletonContent({ variant }: { variant: DealCardSkeletonVariant }) {
  if (variant === 'compact') {
    return (
      <>
        <div className='flex w-full flex-col gap-1.5'>
          <Skeleton className='h-7 w-3/4' />
          <Skeleton className='h-4 w-2/5' />
        </div>
        <Skeleton className='h-5 w-24' />
        <Skeleton className='h-4 w-full' />
      </>
    )
  }

  if (variant === 'standard') {
    return (
      <>
        <div className='flex w-full flex-col gap-1.5'>
          <Skeleton className='h-7 w-4/5' />
          <Skeleton className='h-4 w-1/2' />
          <Skeleton className='h-4 w-full' />
        </div>
        <Skeleton className='h-5 w-28' />
        <div className='flex w-full flex-col gap-1.5'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-4/5' />
        </div>
      </>
    )
  }

  return (
    <>
      <div className='flex w-full flex-col gap-1.5'>
        <Skeleton className='h-7 w-4/5' />
        <Skeleton className='h-4 w-1/2' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-11/12' />
      </div>
      <Skeleton className='h-5 w-28' />
      <div className='flex w-full flex-col gap-1.5'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
        <Skeleton className='h-4 w-2/3' />
      </div>
      <div className='flex items-center gap-2'>
        <Skeleton className='h-4 w-20' />
        <Skeleton className='h-4 w-16' />
      </div>
    </>
  )
}

function DealCardSkeleton({
  height,
  variant,
}: {
  height: number
  variant: DealCardSkeletonVariant
}) {
  return (
    <div
      className='relative box-border flex w-full shrink-0 flex-col gap-3 overflow-hidden rounded-lg border p-2 shadow-sm'
      style={{
        height: `${height}px`,
        minHeight: `${height}px`,
        maxHeight: `${height}px`,
      }}
    >
      <DealCardSkeletonContent variant={variant} />
    </div>
  )
}

export function DealsBoardSkeleton({ showToolbar = false }: { showToolbar?: boolean }) {
  const columns = Array.from({ length: 4 })
  const cardCount = 6

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      {showToolbar ? <DealsFiltersToolbarSkeleton /> : null}
      <div className='flex min-h-0 flex-1 max-w-full min-w-0 items-start gap-1 md:min-w-0 max-md:h-full max-md:gap-0 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:snap-x max-md:snap-mandatory'>
        {columns.map((_, colIdx) => (
          <div
            key={colIdx}
            className='box-border flex min-w-93 w-full flex-1 flex-col items-start justify-start self-start px-2 max-md:w-full max-md:shrink-0 max-md:snap-start max-md:snap-always md:min-w-65 md:px-0 xl:max-w-120'
          >
            <div className='flex w-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm'>
              <ListHeaderSkeleton />
              <div className='flex w-full flex-col space-y-2 p-2'>
                {Array.from({ length: cardCount }).map((_, cardIdx) => {
                  const cardVariant =
                    DEAL_CARD_VARIANTS[(colIdx + cardIdx) % DEAL_CARD_VARIANTS.length]
                  return (
                    <DealCardSkeleton
                      key={cardIdx}
                      height={cardVariant.height}
                      variant={cardVariant.variant}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
