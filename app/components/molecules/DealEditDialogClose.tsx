import { Cross2Icon } from '@radix-ui/react-icons'
import { DialogClose } from '~/components/ui/dialog'
import { cn } from '~/lib/utils'

export function DealEditDialogClose({ className }: { className?: string }) {
  return (
    <DialogClose
      className={cn(
        'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black text-white opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none',
        className,
      )}
    >
      <Cross2Icon className='h-5 w-5' />
      <span className='sr-only'>Close</span>
    </DialogClose>
  )
}
