import type { JSX } from 'react'
import { DialogClose, DialogTitle } from '~/components/ui/dialog'
import { Button } from '../ui/button'

export const DialogFullHeader = ({
  children,
  onAction,
}: { children: JSX.Element; onAction?: () => void }) => {
  return (
    <div className='text-gray-800 font-semibold text-lg py-3 px-4 border border-gray-300 flex justify-between items-center'>
      <DialogTitle>{children}</DialogTitle>
      <div className='flex items-center gap-2'>
        {onAction && (
          <Button
            variant='ghost'
            onClick={onAction}
            className='text-xs text-red-500 hover:text-red-700 hover:bg-red-50'
          >
            Clear
          </Button>
        )}
        <DialogClose>
          <Button variant='ghost' aria-label='Close' size='icon' className='text-2xl'>
            ✕
          </Button>
        </DialogClose>
      </div>
    </div>
  )
}
