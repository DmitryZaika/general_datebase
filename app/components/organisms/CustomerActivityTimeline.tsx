import { format } from 'date-fns'
import {
  CalendarDays,
  Info,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Star,
  Voicemail,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { AudioWaveformPlayer } from '~/components/molecules/AudioWaveformPlayer'
import type { CallEntry } from '~/components/molecules/CallHistory'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import type { Nullable } from '~/types/utils'
import { getMockCallsForCustomer, MOCK_RECORDING_URL } from '~/utils/cloudtalk.mock'
import type { Calls200Response } from '~/utils/cloudtalk.server'

type FilterType = 'all' | 'incoming' | 'outgoing' | 'missed' | 'voicemail'

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'missed', label: 'Missed' },
  { value: 'voicemail', label: 'Voicemail' },
]

const PAGE_SIZE = 10

function mapToCallEntry(item: Calls200Response): CallEntry {
  const { Cdr, Agent, Notes, Tags, Ratings } = item
  return {
    callId: Cdr.id,
    type: Cdr.type,
    startedAt: Cdr.started_at,
    talkingTime: Cdr.talking_time,
    recorded: Cdr.recorded,
    recordingLink: Cdr.recording_link,
    agentName: Agent ? `${Agent.firstname} ${Agent.lastname}`.trim() : 'Unknown',
    publicExternal: Cdr.public_external,
    isVoicemail: Cdr.is_voicemail,
    notes: Notes,
    tags: Tags,
    ratings: Ratings,
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getCallIcon(call: CallEntry) {
  if (call.isVoicemail) return { Icon: Voicemail, color: 'text-amber-500' }
  if (call.type === 'internal') return { Icon: Phone, color: 'text-slate-500' }
  if (call.type === 'outgoing') {
    const noAnswer = call.talkingTime === 0
    return {
      Icon: PhoneOutgoing,
      color: noAnswer ? 'text-slate-400' : 'text-blue-600',
    }
  }
  const isMissed = call.talkingTime === 0
  return {
    Icon: PhoneIncoming,
    color: isMissed ? 'text-red-500' : 'text-green-600',
  }
}

function getCallStatus(call: CallEntry): Nullable<string> {
  if (call.isVoicemail) return 'Voicemail'
  if (call.type === 'incoming' && call.talkingTime === 0) return 'Missed'
  if (call.type === 'outgoing' && call.talkingTime === 0) return 'No answer'
  return null
}

function matchesFilter(call: CallEntry, filter: FilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'voicemail') return call.isVoicemail
  if (filter === 'missed') return call.talkingTime === 0 && call.type === 'incoming'
  return call.type === filter
}

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

function getActivePreset(
  dateFrom?: Date,
  dateTo?: Date,
): Nullable<DatePreset> {
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

function CallItem({ call }: { call: CallEntry }) {
  const { Icon, color } = getCallIcon(call)
  const status = getCallStatus(call)

  return (
    <li className='border rounded p-3 bg-white'>
      <div className='flex items-start gap-3 text-sm'>
        <span className={`mt-0.5 shrink-0 ${color}`}>
          <Icon size={16} />
        </span>

        <div className='flex-1 min-w-0'>
          <div className='flex items-baseline justify-between gap-2'>
            <span className='text-slate-800'>
              {format(new Date(call.startedAt), 'M/d/yyyy h:mm a')}
            </span>
            {status ? (
              <span
                className={`text-xs font-semibold ${
                  status === 'Missed'
                    ? 'text-red-500'
                    : status === 'Voicemail'
                      ? 'text-amber-500'
                      : 'text-slate-400'
                }`}
              >
                {status}
              </span>
            ) : (
              <span className='text-xs text-slate-500'>
                {formatDuration(call.talkingTime)}
              </span>
            )}
          </div>

          <div className='text-xs text-slate-500'>Agent: {call.agentName}</div>

          {call.notes.length > 0 && (
            <div className='mt-1 text-xs text-slate-600'>
              {call.notes.map(n => (
                <div key={n.id} className='italic'>
                  {n.name}
                </div>
              ))}
            </div>
          )}

          {call.tags.length > 0 && (
            <div className='mt-1 flex gap-1 flex-wrap'>
              {call.tags.map(t => (
                <span
                  key={t.id}
                  className='text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded'
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}

          {call.ratings.length > 0 && (
            <div className='mt-1 flex items-center gap-1'>
              {call.ratings.map(r => (
                <span
                  key={r.id}
                  className='flex items-center gap-0.5 text-[10px] text-amber-500'
                >
                  <Star size={10} fill='currentColor' />
                  {r.rating}
                </span>
              ))}
            </div>
          )}

          {call.recorded && (
            <AudioWaveformPlayer audioSrc={MOCK_RECORDING_URL} compact />
          )}
        </div>
      </div>
    </li>
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
  filter: FilterType
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

// Main component

export function CustomerActivityTimeline({
  phone,
  phone2,
}: {
  phone: Nullable<string>
  phone2: Nullable<string>
}) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(daysAgoDate(7))
  const [dateTo, setDateTo] = useState<Date | undefined>(todayDate())
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const hasPhones = !!phone || !!phone2

  const allCalls = useMemo(() => {
    if (!hasPhones) return []
    const raw = getMockCallsForCustomer(phone, phone2)
    return raw
      .map(mapToCallEntry)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }, [hasPhones, phone, phone2])

  const filteredCalls = useMemo(() => {
    let result = allCalls.filter(c => matchesFilter(c, filter))

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
    setDateFrom(daysAgoDate(7))
    setDateTo(todayDate())
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

  // No phone and empty mock data → global empty
  if (!hasPhones && !allCalls.length) {
    return (
      <div className='border rounded p-4'>
        <div className='text-md font-semibold mb-2'>Activity</div>
        <NoPhoneBanner />
        <EmptyGlobal />
      </div>
    )
  }

  // Has phones but no calls at all → global empty
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
          onClearDates={() => handlePreset('7d')}
        />
      ) : (
        <>
          <ul className='space-y-2'>
            {visibleCalls.map(call => (
              <CallItem key={call.callId} call={call} />
            ))}
          </ul>

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
