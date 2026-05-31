import type { ReactNode } from 'react'
import { cn } from '~/lib/utils'

interface ImageFolderCardProps {
  name: string
  onOpen: () => void
  adminActions?: ReactNode
  className?: string
  isDropTarget?: boolean
  onDragOver?: (event: React.DragEvent) => void
  onDragLeave?: (event: React.DragEvent) => void
  onDrop?: (event: React.DragEvent) => void
}

export function ImageFolderCard({
  name,
  onOpen,
  adminActions,
  className,
  isDropTarget = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: ImageFolderCardProps) {
  return (
    <div className={cn('flex w-full flex-col items-center gap-2', className)}>
      <div
        className={cn(
          'relative group w-full max-w-[168px] mx-auto rounded-lg transition',
          isDropTarget && 'ring-2 ring-sky-500 ring-offset-2 bg-sky-50/80',
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <button
          type='button'
          onClick={onOpen}
          className='relative flex w-full cursor-pointer flex-col items-center rounded-lg px-2 py-3 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          aria-label={`Open folder ${name}`}
        >
          <svg
            viewBox='0 0 120 96'
            className='h-[108px] w-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.16)]'
            aria-hidden
          >
            <path
              d='M6 28 C6 22 10 18 16 18 H44 C48 18 51 15 54 12 H104 C110 12 114 16 114 22 V78 C114 84 110 88 104 88 H16 C10 88 6 84 6 78 V28 Z'
              fill='#F4B840'
            />
            <path
              d='M6 28 C6 22 10 18 16 18 H44 C48 18 51 15 54 12 H104 C110 12 114 16 114 22 V30 C114 24 110 20 104 20 H54 C51 17 48 14 44 14 H16 C10 14 6 18 6 24 V28 Z'
              fill='#FFCE56'
            />
          </svg>
          <p className='mt-2 w-full truncate px-1 text-center text-sm font-medium leading-tight'>
            {name}
          </p>
        </button>
        {adminActions ? (
          <div className='pointer-events-none absolute inset-0 flex items-start justify-between p-1 opacity-0 transition-opacity group-hover:opacity-100'>
            <div className='pointer-events-auto flex w-full justify-between'>
              {adminActions}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
