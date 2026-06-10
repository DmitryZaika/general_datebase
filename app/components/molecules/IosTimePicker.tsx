import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '~/components/ui/select'
import { cn } from '~/lib/utils'

const MINUTES = [0, 15, 30, 45]
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const PERIODS = ['AM', 'PM'] as const

const selectTriggerClass =
  'h-8 w-full min-w-0 border-0 border-b-2 border-zinc-800 rounded-none bg-white px-1 shadow-none text-xs font-semibold text-zinc-900 focus:ring-0 [&>svg]:hidden'

const timeSelectContentClass =
  'z-[300] min-w-[5.5rem] rounded-lg border-zinc-200 p-0 shadow-lg [&>button]:hidden [&_[data-radix-select-viewport]]:!h-auto [&_[data-radix-select-viewport]]:max-h-56 [&_[data-radix-select-viewport]]:overflow-y-auto [&_[data-radix-select-viewport]]:p-1 [&_[data-radix-select-viewport]]:[scrollbar-width:thin]'

const periodSelectContentClass =
  'z-[300] min-w-[4.5rem] rounded-lg border-zinc-200 p-0 shadow-lg [&>button]:hidden [&_[data-radix-select-viewport]]:!h-auto [&_[data-radix-select-viewport]]:p-1'

const selectItemClass =
  'cursor-pointer rounded-md py-2 pl-2.5 pr-2.5 text-xs text-zinc-700 focus:bg-zinc-100 focus:text-zinc-900 data-[state=checked]:bg-zinc-100 data-[state=checked]:font-semibold data-[state=checked]:text-zinc-900 [&>span:first-child]:hidden'

type TimeSlot = {
  value: string
  label: string
  hour: number
  minute: number
}

function buildTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (const hour of HOURS_12) {
    for (const minute of MINUTES) {
      const label = `${hour}:${String(minute).padStart(2, '0')}`
      slots.push({ value: label, label, hour, minute })
    }
  }
  return slots
}

const TIME_SLOTS = buildTimeSlots()

function to12Hour(h24: number): { hour: number; period: 'AM' | 'PM' } {
  const period = h24 >= 12 ? ('PM' as const) : ('AM' as const)
  const hour = h24 % 12 || 12
  return { hour, period }
}

function to24Hour(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

function slotLabel(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, '0')}`
}

function timeSlotOptions(currentHour: number, currentMinute: number): TimeSlot[] {
  const currentLabel = slotLabel(currentHour, currentMinute)
  if (TIME_SLOTS.some(slot => slot.value === currentLabel)) return TIME_SLOTS
  return [
    ...TIME_SLOTS,
    {
      value: currentLabel,
      label: currentLabel,
      hour: currentHour,
      minute: currentMinute,
    },
  ].sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour
    return a.minute - b.minute
  })
}

export function IosTimePicker({
  hours24,
  minutes,
  onChange,
  onClear,
  className,
  openTimeOnMount = false,
}: {
  hours24: number
  minutes: number
  onChange: (hours24: number, minutes: number) => void
  onClear: () => void
  className?: string
  openTimeOnMount?: boolean
}) {
  const current = to12Hour(hours24)
  const slotChoices = useMemo(
    () => timeSlotOptions(current.hour, minutes),
    [current.hour, minutes],
  )
  const currentSlot = slotLabel(current.hour, minutes)
  const [timeOpen, setTimeOpen] = useState(openTimeOnMount)
  const [periodOpen, setPeriodOpen] = useState(false)

  const apply = (hour: number, minute: number, period: 'AM' | 'PM') => {
    onChange(to24Hour(hour, period), minute)
  }

  const handleTimeOpenChange = (open: boolean) => {
    setTimeOpen(open)
    if (open) setPeriodOpen(false)
  }

  const handlePeriodOpenChange = (open: boolean) => {
    setPeriodOpen(open)
    if (open) setTimeOpen(false)
  }

  return (
    <div
      className={cn(
        'relative rounded-xl border border-zinc-200 bg-white px-3 py-3',
        className,
      )}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className='flex items-end gap-2'>
        <div className='relative z-10 min-w-[5.5rem] flex-1'>
          <Select
            open={timeOpen}
            onOpenChange={handleTimeOpenChange}
            value={currentSlot}
            onValueChange={val => {
              const slot = slotChoices.find(item => item.value === val)
              if (!slot) return
              apply(slot.hour, slot.minute, current.period)
              setTimeOpen(false)
            }}
          >
            <SelectTrigger className={selectTriggerClass}>
              <span className='block w-full truncate text-left'>{currentSlot}</span>
            </SelectTrigger>
            <SelectContent className={timeSelectContentClass} position='popper'>
              {slotChoices.map(slot => (
                <SelectItem
                  key={slot.value}
                  value={slot.value}
                  className={selectItemClass}
                >
                  {slot.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='relative z-10 w-[3.75rem] shrink-0'>
          <Select
            open={periodOpen}
            onOpenChange={handlePeriodOpenChange}
            value={current.period}
            onValueChange={val => {
              apply(current.hour, minutes, val as 'AM' | 'PM')
              setPeriodOpen(false)
            }}
          >
            <SelectTrigger className={selectTriggerClass}>
              <span className='block w-full truncate text-left'>{current.period}</span>
            </SelectTrigger>
            <SelectContent className={periodSelectContentClass} position='popper'>
              {PERIODS.map(period => (
                <SelectItem key={period} value={period} className={selectItemClass}>
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant='ghost'
          size='icon'
          type='button'
          className='mb-0.5 h-7 w-7 shrink-0 text-zinc-400 hover:text-red-500'
          onClick={onClear}
        >
          <X className='h-3.5 w-3.5' />
        </Button>
      </div>
    </div>
  )
}

export function isNestedSelectTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest('[data-radix-select-content]') ||
      target.closest('[data-radix-select-viewport]') ||
      target.closest('[data-radix-select-trigger]') ||
      target.closest('[data-radix-popper-content-wrapper]') ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="combobox"]'),
  )
}
