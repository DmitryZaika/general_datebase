import { X } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '~/components/ui/select'
import { cn } from '~/lib/utils'

const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i))
const MINUTES_15 = [0, 15, 30, 45]
const PERIODS = ['AM', 'PM'] as const

const selectTriggerClass =
  'h-8 w-full border-0 border-b-2 border-zinc-800 rounded-none bg-white px-1 shadow-none text-xs font-semibold text-zinc-900 focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-40'

const selectContentClass =
  'z-[200] max-h-48 min-w-[4.5rem] rounded-lg border-zinc-200 p-1 shadow-lg [&_[data-radix-select-viewport]]:h-auto [&_[data-radix-select-viewport]]:max-h-40'

const selectItemClass =
  'cursor-pointer rounded-md py-2 pl-2.5 pr-2.5 text-xs text-zinc-700 focus:bg-zinc-100 focus:text-zinc-900 data-[state=checked]:bg-zinc-100 data-[state=checked]:font-semibold data-[state=checked]:text-zinc-900 [&>span:first-child]:hidden'

function to12Hour(h24: number): { hour: number; period: 'AM' | 'PM' } {
  const period = h24 >= 12 ? ('PM' as const) : ('AM' as const)
  const hour = h24 % 12 || 12
  return { hour, period }
}

function to24Hour(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

function minuteOptions(currentMin: number): number[] {
  if (MINUTES_15.includes(currentMin)) return MINUTES_15
  return [...MINUTES_15, currentMin].sort((a, b) => a - b)
}

export function IosTimePicker({
  hours24,
  minutes,
  onChange,
  onClear,
  className,
}: {
  hours24: number
  minutes: number
  onChange: (hours24: number, minutes: number) => void
  onClear: () => void
  className?: string
}) {
  const current = to12Hour(hours24)
  const minuteChoices = useMemo(() => minuteOptions(minutes), [minutes])

  const apply = (hour: number, minute: number, period: 'AM' | 'PM') => {
    onChange(to24Hour(hour, period), minute)
  }

  return (
    <div
      className={cn(
        'relative rounded-xl border border-zinc-200 bg-white px-3 py-3',
        className,
      )}
    >
      <Button
        variant='ghost'
        size='icon'
        type='button'
        className='absolute right-1 top-1 h-7 w-7 text-zinc-400 hover:text-red-500'
        onClick={onClear}
      >
        <X className='h-3.5 w-3.5' />
      </Button>
      <div className='flex items-end gap-2 pr-6'>
        <div className='min-w-0 flex-1'>
          <Select
            value={String(current.hour)}
            onValueChange={val => apply(Number(val), minutes, current.period)}
          >
            <SelectTrigger className={selectTriggerClass}>
              <span className='flex-1 text-left'>{current.hour}</span>
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {HOURS_12.map(hour => (
                <SelectItem key={hour} value={String(hour)} className={selectItemClass}>
                  {hour}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className='pb-1.5 text-sm font-semibold text-zinc-400'>:</span>
        <div className='min-w-0 flex-1'>
          <Select
            value={String(minutes)}
            onValueChange={val => apply(current.hour, Number(val), current.period)}
          >
            <SelectTrigger className={selectTriggerClass}>
              <span className='flex-1 text-left'>
                {String(minutes).padStart(2, '0')}
              </span>
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {minuteChoices.map(minute => (
                <SelectItem
                  key={minute}
                  value={String(minute)}
                  className={selectItemClass}
                >
                  {String(minute).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='min-w-0 flex-1'>
          <Select
            value={current.period}
            onValueChange={val => apply(current.hour, minutes, val as 'AM' | 'PM')}
          >
            <SelectTrigger className={selectTriggerClass}>
              <span className='flex-1 text-left'>{current.period}</span>
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {PERIODS.map(period => (
                <SelectItem key={period} value={period} className={selectItemClass}>
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export function isNestedSelectTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest('[data-radix-select-content]') ||
      target.closest('[data-radix-select-viewport]') ||
      target.closest('[role="listbox"]'),
  )
}
