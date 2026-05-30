import { Skeleton } from '~/components/ui/skeleton'

const MODULE_GRID_CLASS =
  'grid grid-cols-2 gap-2 px-2 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7'

const ADMIN_GRID_CLASS =
  'grid grid-cols-2 gap-3 px-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'

function getMediaGridClass(layout: 'module' | 'admin') {
  return layout === 'admin' ? ADMIN_GRID_CLASS : MODULE_GRID_CLASS
}

const NAME_WIDTHS = ['w-3/4', 'w-5/6', 'w-2/3', 'w-4/5', 'w-3/5', 'w-11/12']

function MediaImagesToolbarSkeleton() {
  return (
    <div className='mb-2 flex flex-wrap items-center gap-3 px-2'>
      <Skeleton className='h-9 w-28 rounded-md' />
      <Skeleton className='h-9 w-32 rounded-md' />
    </div>
  )
}

function MediaFolderHeaderSkeleton() {
  return (
    <div className='mb-4 flex flex-wrap items-center gap-3 px-2'>
      <Skeleton className='h-9 w-28 rounded-md' />
      <Skeleton className='h-6 w-40' />
    </div>
  )
}

function MediaFolderTileSkeleton() {
  return (
    <div className='flex w-full flex-col items-center gap-2'>
      <Skeleton className='mx-auto h-[108px] w-full max-w-[168px] rounded-lg' />
      <Skeleton className='h-4 w-20' />
    </div>
  )
}

function MediaImageTileSkeleton({
  nameWidth,
  layout = 'module',
}: {
  nameWidth: string
  layout?: 'module' | 'admin'
}) {
  return (
    <div className='flex w-full flex-col items-center gap-2'>
      <Skeleton
        className={
          layout === 'admin'
            ? 'h-48 w-full rounded border'
            : 'h-40 w-full rounded border'
        }
      />
      <Skeleton className={`h-4 ${nameWidth}`} />
    </div>
  )
}

export function MediaGridSkeleton({
  showToolbar = false,
  showFolderHeader = false,
  showFolders = false,
  folderCount = 4,
  cardCount = 14,
  layout = 'module',
}: {
  showToolbar?: boolean
  showFolderHeader?: boolean
  showFolders?: boolean
  folderCount?: number
  cardCount?: number
  layout?: 'module' | 'admin'
}) {
  const gridClass = getMediaGridClass(layout)

  return (
    <div className='w-full'>
      {showToolbar ? <MediaImagesToolbarSkeleton /> : null}
      {showFolderHeader ? <MediaFolderHeaderSkeleton /> : null}
      {showFolders ? (
        <div className={`${gridClass} mb-3`}>
          {Array.from({ length: folderCount }).map((_, idx) => (
            <MediaFolderTileSkeleton key={`folder-${idx}`} />
          ))}
        </div>
      ) : null}
      <div className={gridClass}>
        {Array.from({ length: cardCount }).map((_, idx) => (
          <MediaImageTileSkeleton
            key={`image-${idx}`}
            nameWidth={NAME_WIDTHS[idx % NAME_WIDTHS.length]}
            layout={layout}
          />
        ))}
      </div>
    </div>
  )
}

export function MediaGridContentSkeleton({
  showToolbar = false,
  showFolderHeader = false,
  showFolders = false,
  folderCount = 4,
  cardCount = 14,
  layout = 'module',
}: {
  showToolbar?: boolean
  showFolderHeader?: boolean
  showFolders?: boolean
  folderCount?: number
  cardCount?: number
  layout?: 'module' | 'admin'
}) {
  return (
    <MediaGridSkeleton
      showToolbar={showToolbar}
      showFolderHeader={showFolderHeader}
      showFolders={showFolders}
      folderCount={folderCount}
      cardCount={cardCount}
      layout={layout}
    />
  )
}
