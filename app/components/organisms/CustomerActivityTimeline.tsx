import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AlertTriangle, CalendarDays, Info, Phone } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Spinner } from '~/components/atoms/Spinner'
import { CallItemContent } from '~/components/molecules/CallItemContent'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import type { Nullable } from '~/types/utils'
import {
  type CallFilterType,
  mapToCallEntry,
  matchesCallFilter,
} from '~/utils/callDisplayHelpers'
import type { Calls200Response } from '~/utils/cloudtalk.server'

const FILTER_OPTIONS: { value: CallFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'missed', label: 'Missed' },
  { value: 'voicemail', label: 'Voicemail' },
]

const PAGE_SIZE = 10

// Sub-components

type DatePreset = '7d' | '30d' | '90d' | 'all'

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All time' },
]

function daysAgoDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function todayDate(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function getActivePreset(dateFrom?: Date, dateTo?: Date): Nullable<DatePreset> {
  if (!dateFrom && !dateTo) return 'all'
  if (!dateFrom) return null
  if (isSameDay(dateFrom, daysAgoDate(7))) return '7d'
  if (isSameDay(dateFrom, daysAgoDate(30))) return '30d'
  if (isSameDay(dateFrom, daysAgoDate(90))) return '90d'
  return null
}

function DateRangePicker({
  dateFrom,
  dateTo,
  onRangeChange,
  onPreset,
}: {
  dateFrom?: Date
  dateTo?: Date
  onRangeChange: (range?: DateRange) => void
  onPreset: (preset: DatePreset) => void
}) {
  const activePreset = getActivePreset(dateFrom, dateTo)

  const label =
    dateFrom && dateTo
      ? `${format(dateFrom, 'M/d/yyyy')} – ${format(dateTo, 'M/d/yyyy')}`
      : dateFrom
        ? `${format(dateFrom, 'M/d/yyyy')} – ...`
        : 'Pick dates'

  return (
    <div className='flex items-center gap-1 flex-wrap'>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline' size='sm' className='text-xs gap-1 ml-1'>
            <CalendarDays size={12} />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            mode='range'
            selected={dateFrom ? { from: dateFrom, to: dateTo } : undefined}
            onSelect={onRangeChange}
          />
        </PopoverContent>
      </Popover>

      {DATE_PRESETS.map(p => (
        <button
          key={p.value}
          type='button'
          onClick={() => onPreset(p.value)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            activePreset === p.value
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function EmptyGlobal() {
  return (
    <div className='flex flex-col items-center justify-center py-8 text-center'>
      <Phone size={24} className='text-slate-300 mb-3' />
      <div className='text-sm font-medium text-slate-500'>No call activity yet</div>
      <div className='text-xs text-slate-400 mt-1'>
        Calls with this customer will appear here
        <br />
        once interactions begin.
      </div>
    </div>
  )
}

function EmptyFiltered({
  filter,
  dateFrom,
  dateTo,
  onClearFilters,
  onClearDates,
}: {
  filter: CallFilterType
  dateFrom?: Date
  dateTo?: Date
  onClearFilters: () => void
  onClearDates: () => void
}) {
  const hasDateFilter = dateFrom || dateTo

  if (hasDateFilter && filter === 'all') {
    return (
      <div className='flex flex-col items-center py-6 text-center'>
        <div className='text-sm text-slate-500'>
          No activity found
          {dateFrom && dateTo
            ? ` between ${format(dateFrom, 'M/d/yyyy')} and ${format(dateTo, 'M/d/yyyy')}`
            : ''}
        </div>
        <button
          type='button'
          onClick={onClearDates}
          className='text-xs text-blue-500 underline mt-2'
        >
          Clear date range
        </button>
      </div>
    )
  }

  const filterLabel = FILTER_OPTIONS.find(o => o.value === filter)?.label.toLowerCase()

  return (
    <div className='flex flex-col items-center py-6 text-center'>
      <div className='text-sm text-slate-500'>
        No {filterLabel} calls found for this customer
      </div>
      <button
        type='button'
        onClick={onClearFilters}
        className='text-xs text-blue-500 underline mt-2'
      >
        Clear all filters
      </button>
    </div>
  )
}

function NoPhoneBanner() {
  return (
    <div className='flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-3 mb-3'>
      <Info size={14} className='text-slate-400 shrink-0' />
      <span className='text-xs text-slate-500'>
        No phone number on file — call history is unavailable
      </span>
    </div>
  )
}

function LoadingState() {
  return (
    <div className='flex items-center justify-center gap-2 py-8 text-sm text-slate-500'>
      <Spinner size={16} />
      Loading activity...
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className='flex flex-col items-center justify-center py-8 text-center'>
      <AlertTriangle size={24} className='text-amber-500 mb-3' />
      <div className='text-sm font-medium text-slate-600'>Unable to load activity</div>
      <button
        type='button'
        onClick={onRetry}
        className='text-xs text-blue-500 underline mt-2'
      >
        Try again
      </button>
    </div>
  )
}

// Main component

export function CustomerActivityTimeline({
  phone,
  phone2,
}: {
  phone: Nullable<string>
  phone2: Nullable<string>
}) {
  const [filter, setFilter] = useState<CallFilterType>('all')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const hasPhones = !!phone || !!phone2

  const queryKey = ['cloudtalk-customer-calls', phone, phone2] as const

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (phone) qs.set('phone', phone)
      if (phone2) qs.set('phone2', phone2)
      const r = await fetch(`/api/cloudtalk/customerCalls?${qs}`)
      if (!r.ok) throw new Error(`CloudTalk ${r.status}`)
      return (await r.json()) as { items: Calls200Response[] }
    },
    enabled: hasPhones,
    staleTime: 60_000,
  })

  const allCalls = useMemo(() => {
    const items = data?.items ?? []
    return items
      .map(mapToCallEntry)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }, [data])

  const filteredCalls = useMemo(() => {
    let result = allCalls.filter(c => matchesCallFilter(c, filter))

    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      result = result.filter(c => new Date(c.startedAt) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(c => new Date(c.startedAt) <= to)
    }

    return result
  }, [allCalls, filter, dateFrom, dateTo])

  const visibleCalls = filteredCalls.slice(0, visibleCount)
  const hasMore = visibleCount < filteredCalls.length
  const hasActiveFilters =
    filter !== 'all' || dateFrom !== undefined || dateTo !== undefined

  const clearAllFilters = () => {
    setFilter('all')
    setDateFrom(undefined)
    setDateTo(undefined)
    setVisibleCount(PAGE_SIZE)
  }

  const handlePreset = (preset: DatePreset) => {
    setVisibleCount(PAGE_SIZE)
    if (preset === 'all') {
      setDateFrom(undefined)
      setDateTo(undefined)
      return
    }
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
    setDateFrom(daysAgoDate(days))
    setDateTo(todayDate())
  }

  if (!hasPhones) {
    return (
      <div className='border rounded p-4'>
        <div className='text-md font-semibold mb-2'>Activity</div>
        <NoPhoneBanner />
        <EmptyGlobal />
      </div>
    )
  }

  if (isError) {
    return (
      <div className='border rounded p-4'>
        <div className='text-md font-semibold mb-2'>Activity</div>
        <ErrorState onRetry={() => refetch()} />
      </div>
    )
  }

  if (isLoading && !data) {
    return (
      <div className='border rounded p-4'>
        <div className='text-md font-semibold mb-2'>Activity</div>
        <LoadingState />
      </div>
    )
  }

  if (!allCalls.length) {
    return (
      <div className='border rounded p-4'>
        <div className='text-md font-semibold mb-2'>Activity</div>
        <EmptyGlobal />
      </div>
    )
  }

  return (
    <div className='border rounded p-4'>
      <div className='text-md font-semibold mb-3'>Activity</div>

      {!hasPhones && <NoPhoneBanner />}

      <div className='space-y-3 mb-3'>
        <div className='flex gap-1 flex-wrap'>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type='button'
              onClick={() => {
                setFilter(opt.value)
                setVisibleCount(PAGE_SIZE)
              }}
              disabled={!hasPhones && opt.value !== 'all'}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === opt.value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onRangeChange={range => {
            setDateFrom(range?.from)
            setDateTo(range?.to)
            setVisibleCount(PAGE_SIZE)
          }}
          onPreset={handlePreset}
        />
      </div>

      {!filteredCalls.length && hasActiveFilters ? (
        <EmptyFiltered
          filter={filter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClearFilters={clearAllFilters}
          onClearDates={() => handlePreset('all')}
        />
      ) : (
        <>
          <ul className='space-y-2'>
            {visibleCalls.map(call => (
              <li key={call.callId} className='border rounded p-3 bg-white'>
                <CallItemContent
                  call={call}
                  audioSrc={`/api/cloudtalk/userCallMedia/${call.callId}`}
                />
              </li>
            ))}
          </ul>

          {isFetching && (
            <div className='mt-2 flex items-center justify-center'>
              <Spinner size={14} />
            </div>
          )}

          {hasMore && (
            <div className='mt-3 text-center'>
              <button
                type='button'
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className='text-xs text-blue-500 underline'
              >
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
