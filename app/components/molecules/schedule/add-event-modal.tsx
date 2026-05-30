import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { CalendarIcon, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormField, FormProvider } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Variant } from '@/types'
import { useFullFetcher } from '~/hooks/useFullFetcher'
import { formatPickerDeadline } from '~/lib/dateHelpers'
import { eventSchema } from '~/schemas/events'

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5)

function to12Hour(h24: number): { hour: number; period: 'AM' | 'PM' } {
  const period = h24 >= 12 ? ('PM' as const) : ('AM' as const)
  const hour = h24 % 12 || 12
  return { hour, period }
}

function to24Hour(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function calendarDayTime(date: Date): number {
  return startOfDay(date).getTime()
}

function ensureEndAfterStart(start: Date, end: Date, allDay: boolean): Date {
  if (allDay) {
    const normalizedEnd = endOfDay(end)
    if (calendarDayTime(normalizedEnd) >= calendarDayTime(start)) {
      return normalizedEnd
    }
    return endOfDay(start)
  }
  if (end >= start) return end
  const next = new Date(start)
  next.setHours(start.getHours() + 1, start.getMinutes(), 0, 0)
  return next
}

function EventTimeControls({
  value,
  onTimeChange,
}: {
  value: Date
  onTimeChange: (hours: number, minutes: number) => void
}) {
  const current = to12Hour(value.getHours())
  const currentMin = value.getMinutes()
  const minuteOptions = MINUTES_5.includes(currentMin)
    ? MINUTES_5
    : [...MINUTES_5, currentMin].sort((a, b) => a - b)

  return (
    <div className='flex items-center gap-1.5 px-3 pb-3 border-t pt-2'>
      <Clock className='h-3.5 w-3.5 text-gray-600 shrink-0' />
      <Select
        value={String(current.hour)}
        onValueChange={val => {
          const h24 = to24Hour(Number(val), current.period)
          onTimeChange(h24, currentMin)
        }}
      >
        <SelectTrigger className='w-[58px] h-7 text-sm px-2'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent stableScrollButtons>
          {HOURS_12.map(h => (
            <SelectItem key={h} value={String(h)}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className='text-sm font-medium text-gray-500'>:</span>
      <Select
        value={String(currentMin)}
        onValueChange={val => {
          const h24 = to24Hour(current.hour, current.period)
          onTimeChange(h24, Number(val))
        }}
      >
        <SelectTrigger className='w-[58px] h-7 text-sm px-2'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent stableScrollButtons>
          {minuteOptions.map(m => (
            <SelectItem key={m} value={String(m)}>
              {String(m).padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={current.period}
        onValueChange={val => {
          const h24 = to24Hour(current.hour, val as 'AM' | 'PM')
          onTimeChange(h24, currentMin)
        }}
      >
        <SelectTrigger className='w-[62px] h-7 text-sm px-2'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent stableScrollButtons>
          <SelectItem value='AM'>AM</SelectItem>
          <SelectItem value='PM'>PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

function EventDateTimePicker({
  label,
  value,
  onChange,
  allDay,
  boundary,
  minDate,
  maxDate,
}: {
  label: string
  value: Date
  onChange: (date: Date) => void
  allDay: boolean
  boundary: 'start' | 'end'
  minDate?: Date
  maxDate?: Date
}) {
  const [open, setOpen] = useState(false)
  const [calendarKey, setCalendarKey] = useState(0)

  const displayLabel = allDay
    ? formatPickerDeadline(startOfDay(value))
    : formatPickerDeadline(value)
  const calendarSelected = allDay ? startOfDay(value) : value

  const disabledDays =
    minDate || maxDate
      ? {
          ...(minDate ? { before: startOfDay(minDate) } : {}),
          ...(maxDate ? { after: startOfDay(maxDate) } : {}),
        }
      : undefined

  return (
    <div>
      <Label>{label}</Label>
      <Popover
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen)
          if (nextOpen) setCalendarKey(k => k + 1)
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='outline'
            className={cn(
              'mt-1 w-full h-9 justify-start text-left text-sm font-normal',
              !value && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className='mr-1.5 h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{displayLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            key={calendarKey}
            mode='single'
            defaultMonth={calendarSelected}
            selected={calendarSelected}
            disabled={disabledDays}
            onSelect={day => {
              if (!day) return
              if (allDay) {
                onChange(boundary === 'start' ? startOfDay(day) : endOfDay(day))
                return
              }
              const next = new Date(day)
              next.setHours(value.getHours(), value.getMinutes(), 0, 0)
              onChange(next)
            }}
          />
          {!allDay ? (
            <EventTimeControls
              value={value}
              onTimeChange={(hours, minutes) => {
                const next = new Date(value)
                next.setHours(hours, minutes, 0, 0)
                onChange(next)
              }}
            />
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface AddEventModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues?: {
    title?: string
    description?: string
    startDate?: Date
    endDate?: Date
    variant?: Variant
    id?: number
    notes?: string
    allDay?: boolean
  }
}

function getEventColor(variant: Variant) {
  switch (variant) {
    case 'primary':
      return 'blue'
    case 'danger':
      return 'red'
    case 'success':
      return 'green'
    case 'warning':
      return 'yellow'
    default:
      return 'blue'
  }
}

function buildFormValues(defaultValues?: AddEventModalProps['defaultValues']) {
  const start = defaultValues?.startDate
    ? new Date(defaultValues.startDate)
    : new Date()
  const end = defaultValues?.endDate ? new Date(defaultValues.endDate) : new Date()
  const allDay = defaultValues?.allDay ?? false

  if (allDay) {
    return {
      id: defaultValues?.id || undefined,
      title: defaultValues?.title || '',
      description: defaultValues?.description || '',
      start_date: startOfDay(start),
      end_date: endOfDay(end),
      color: getEventColor(defaultValues?.variant || 'primary'),
      all_day: true,
      status: 'scheduled',
      notes: defaultValues?.notes || '',
    }
  }

  return {
    id: defaultValues?.id || undefined,
    title: defaultValues?.title || '',
    description: defaultValues?.description || '',
    start_date: start,
    end_date: end,
    color: getEventColor(defaultValues?.variant || 'primary'),
    all_day: false,
    status: 'scheduled',
    notes: defaultValues?.notes || '',
  }
}

export default function AddEventModal({
  open,
  onOpenChange,
  defaultValues,
}: AddEventModalProps) {
  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: buildFormValues(defaultValues),
  })

  const { fullSubmit } = useFullFetcher(
    form,
    '/api/events',
    defaultValues?.id ? 'PUT' : 'POST',
  )

  const { watch, setValue, handleSubmit, reset } = form
  const selectedColor = watch('color')
  const allDay = watch('all_day')
  const startDate = watch('start_date')
  const endDate = watch('end_date')

  useEffect(() => {
    if (!open) return
    reset(buildFormValues(defaultValues))
  }, [open, defaultValues, reset])

  const colorOptions = [
    { key: 'blue', name: 'Blue' },
    { key: 'red', name: 'Red' },
    { key: 'green', name: 'Green' },
    { key: 'yellow', name: 'Yellow' },
  ]

  const handleAllDayChange = (checked: boolean) => {
    setValue('all_day', checked)
    if (checked) {
      const nextStart = startOfDay(startDate)
      let nextEnd = endOfDay(endDate)
      if (nextEnd < nextStart) {
        nextEnd = endOfDay(nextStart)
      }
      setValue('start_date', nextStart)
      setValue('end_date', nextEnd)
      return
    }
    const nextStart = new Date(startDate)
    if (nextStart.getHours() === 0 && nextStart.getMinutes() === 0) {
      nextStart.setHours(9, 0, 0, 0)
    }
    let nextEnd = new Date(endDate)
    if (
      nextEnd.getHours() === 23 &&
      nextEnd.getMinutes() === 59 &&
      nextEnd.getSeconds() === 59
    ) {
      nextEnd = new Date(nextStart)
      nextEnd.setHours(nextStart.getHours() + 1, nextStart.getMinutes(), 0, 0)
    }
    setValue('start_date', nextStart)
    setValue('end_date', ensureEndAfterStart(nextStart, nextEnd, false))
  }

  const onSubmit = async () => {
    await fullSubmit()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{defaultValues?.id ? 'Edit Event' : 'Add Event'}</DialogTitle>
          <DialogDescription className='text-sm text-muted-foreground'>
            {defaultValues?.id ? 'Edit an existing event' : 'Add a new event'}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <div>
                  <Label htmlFor='title'>Event Name</Label>
                  <Input
                    id='title'
                    {...field}
                    placeholder='Enter event name'
                    className={cn(form.formState.errors.title && 'border-red-500')}
                  />
                  {form.formState.errors.title ? (
                    <p className='text-sm text-red-500 mt-1'>
                      {form.formState.errors.title.message}
                    </p>
                  ) : null}
                </div>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <div>
                  <Label htmlFor='description'>Description</Label>
                  <Textarea
                    id='description'
                    {...field}
                    placeholder='Enter event description'
                  />
                </div>
              )}
            />

            <FormField
              control={form.control}
              name='all_day'
              render={({ field }) => (
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id='all_day'
                    checked={field.value}
                    onCheckedChange={checked => handleAllDayChange(checked === true)}
                  />
                  <Label htmlFor='all_day' className='cursor-pointer font-normal'>
                    All day
                  </Label>
                </div>
              )}
            />

            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='start_date'
                render={({ field }) => (
                  <EventDateTimePicker
                    label='Start Date'
                    value={field.value}
                    allDay={allDay}
                    boundary='start'
                    maxDate={allDay ? endDate : undefined}
                    onChange={nextStart => {
                      field.onChange(nextStart)
                      if (allDay) {
                        if (calendarDayTime(endDate) < calendarDayTime(nextStart)) {
                          setValue('end_date', endOfDay(nextStart))
                        }
                        return
                      }
                      setValue(
                        'end_date',
                        ensureEndAfterStart(nextStart, endDate, false),
                      )
                    }}
                  />
                )}
              />

              <FormField
                control={form.control}
                name='end_date'
                render={({ field }) => (
                  <EventDateTimePicker
                    label='End Date'
                    value={field.value}
                    allDay={allDay}
                    boundary='end'
                    minDate={allDay ? startDate : undefined}
                    onChange={nextEnd => {
                      field.onChange(
                        allDay
                          ? ensureEndAfterStart(startDate, nextEnd, true)
                          : ensureEndAfterStart(startDate, nextEnd, false),
                      )
                    }}
                  />
                )}
              />
            </div>
            {form.formState.errors.end_date ? (
              <p className='text-sm text-red-500'>
                {form.formState.errors.end_date.message}
              </p>
            ) : null}

            <FormField
              control={form.control}
              name='notes'
              render={({ field }) => (
                <div>
                  <Label htmlFor='notes'>Notes</Label>
                  <Textarea id='notes' {...field} placeholder='Additional notes' />
                </div>
              )}
            />

            <div>
              <Label>Color</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type='button'
                    variant='outline'
                    className={clsx('w-fit my-2', {
                      'bg-blue-500 hover:bg-blue-600 text-white':
                        selectedColor === 'blue',
                      'bg-red-500 hover:bg-red-600 text-white': selectedColor === 'red',
                      'bg-green-500 hover:bg-green-600 text-white':
                        selectedColor === 'green',
                      'bg-yellow-500 hover:bg-yellow-600 text-white':
                        selectedColor === 'yellow',
                    })}
                  >
                    {colorOptions.find(color => color.key === selectedColor)?.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {colorOptions.map(color => (
                    <DropdownMenuItem
                      key={color.key}
                      onClick={() => {
                        setValue('color', color.key)
                      }}
                    >
                      <div className='flex items-center'>
                        <div
                          className={clsx('w-4 h-4 rounded-full mr-2', {
                            'bg-blue-500': color.key === 'blue',
                            'bg-red-500': color.key === 'red',
                            'bg-green-500': color.key === 'green',
                            'bg-yellow-500': color.key === 'yellow',
                          })}
                        />
                        {color.name}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type='submit'>
                {defaultValues?.id ? 'Update Event' : 'Save Event'}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
