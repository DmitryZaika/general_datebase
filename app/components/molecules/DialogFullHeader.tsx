import type { JSX, ReactNode } from 'react'
import { DialogClose, DialogTitle } from '~/components/ui/dialog'
import { Button } from '../ui/button'

export const DialogFullHeader = ({
  children,
  actions,
}: {
  children: JSX.Element
  actions?: ReactNode
}) => {
  return (
    <div className='text-gray-800 font-semibold text-lg py-3 px-4 border border-gray-300 flex justify-between items-center gap-3'>
      <DialogTitle>{children}</DialogTitle>
      <div className='flex items-center gap-1 shrink-0'>
        {actions}
        <DialogClose>
          <Button variant='ghost' aria-label='Close' size='icon' className='text-2xl'>
            ✕
          </Button>
        </DialogClose>
      </div>
    </div>
  )
}
