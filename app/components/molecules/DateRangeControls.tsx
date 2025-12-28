import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'

export function DateRangeControls({
  from,
  to,
  setFrom,
  setTo,
  onClear,
  applyButtonType = 'submit',
}: {
  from?: Date
  to?: Date
  setFrom: (d: Date | undefined) => void
  setTo: (d: Date | undefined) => void
  onClear: () => void
  applyButtonType?: 'button' | 'submit'
}) {
  return (
    <div className='flex-col flex-wrap items-center gap-2 max-w-[400px]'>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            className={cn(
              'w-[200px] justify-start text-left font-normal',
              !from && 'text-muted-foreground',
            )}
            type='button'
          >
            <CalendarIcon className='mr-2 h-4 w-4' />
            {from ? format(from, 'PPP') : <span>Select start date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar mode='single' selected={from} onSelect={setFrom} initialFocus />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            className={cn(
              'w-[200px] justify-start text-left font-normal',
              !to && 'text-muted-foreground',
            )}
            type='button'
          >
            <CalendarIcon className='mr-2 h-4 w-4' />
            {to ? format(to, 'PPP') : <span>Select end date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0 ' align='start'>
          <Calendar mode='single' selected={to} onSelect={setTo} initialFocus />
        </PopoverContent>
      </Popover>

      <Button type='button' variant='outline' className='w-[50%]' onClick={onClear}>
        Clear
      </Button>
      <Button className='w-[50%]' type={applyButtonType}>
        Apply
      </Button>
    </div>
  )
}
