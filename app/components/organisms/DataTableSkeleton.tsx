import { Skeleton } from '~/components/ui/skeleton'

const CELL_WIDTHS = ['w-36', 'w-44', 'w-28', 'w-48', 'w-32', 'w-24']

function getGridClass(columnCount: number) {
  if (columnCount <= 1) return 'grid-cols-1'
  if (columnCount === 2) return 'grid-cols-2'
  if (columnCount <= 4) return 'grid-cols-2 sm:grid-cols-4'
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
}

export function DataTableSkeleton({
  columnCount = 4,
  rowCount = 10,
}: {
  columnCount?: number
  rowCount?: number
}) {
  const gridClass = getGridClass(columnCount)

  return (
    <div className='rounded-md border bg-white'>
      <div className={`grid ${gridClass} gap-4 border-b p-3`}>
        {Array.from({ length: columnCount }).map((_, idx) => (
          <Skeleton key={`header-${idx}`} className='h-8 w-24' />
        ))}
      </div>
      {Array.from({ length: rowCount }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className={`grid ${gridClass} gap-4 border-b p-3 last:border-b-0`}
        >
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={`h-4 ${CELL_WIDTHS[(rowIdx + colIdx) % CELL_WIDTHS.length]}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function DocumentsPageSkeleton() {
  return (
    <div className='p-2 sm:p-5'>
      <Skeleton className='mb-4 h-8 w-36' />
      <DataTableSkeleton columnCount={1} rowCount={8} />
    </div>
  )
}

export function SuppliersPageSkeleton() {
  return (
    <div className='p-2 sm:p-5'>
      <DataTableSkeleton columnCount={6} rowCount={10} />
    </div>
  )
}
