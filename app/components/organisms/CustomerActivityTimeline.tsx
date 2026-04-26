import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  AlertTriangle,
  CalendarDays,
  Eye,
  EyeClosed,
  Info,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
} from 'lucide-react'
import {
  type ComponentType,
  type ReactNode,
  type SVGProps,
  useMemo,
  useState,
} from 'react'
import type { DateRange } from 'react-day-picker'
import { Link } from 'react-router'
import { Spinner } from '~/components/atoms/Spinner'
import { CallItemContent } from '~/components/molecules/CallItemContent'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import type { EmailHistory } from '~/crud/emails'
import { cn } from '~/lib/utils'
import type { Nullable } from '~/types/utils'
import {
  type CallEntry,
  type CallFilterType,
  mapToCallEntry,
  matchesCallFilter,
} from '~/utils/callDisplayHelpers'
import type { Calls200Response } from '~/utils/cloudtalk.server'
import { phoneDigitsOnly } from '~/utils/phone'
import { mapRowToSmsEntry, type SmsEntry, type SmsRow } from '~/utils/smsDisplayHelpers'
import { stripHtmlTags } from '~/utils/stringHelpers'

type TimelineItem =
  | { type: 'call'; data: CallEntry; date: string }
  | { type: 'sms'; data: SmsEntry; date: string }
  | { type: 'email'; data: EmailHistory; date: string }

type CustomerActivityFilterType = CallFilterType | 'sms' | 'emails'

const FILTER_OPTIONS: { value: CustomerActivityFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'missed', label: 'Missed' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'sms', label: 'SMS' },
  { value: 'emails', label: 'Emails' },
]

const PAGE_SIZE = 10

function matchesItemFilter(
  item: TimelineItem,
  filter: CustomerActivityFilterType,
): boolean {
  if (filter === 'all') return true
  if (filter === 'sms') return item.type === 'sms'
  if (filter === 'emails') return item.type === 'email'
  return item.type === 'call' && matchesCallFilter(item.data, filter)
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
        Calls and SMS with this customer will appear here
        <br />
        once interactions begin.
      </div>
    </div>
  )
}

function makeEmailSnippet(body: string | null | undefined, max = 120): string {
  if (!body) return ''
  const text = stripHtmlTags(body)
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}...`
}

function SmsActivityRow({ message }: { message: SmsEntry }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isOutbound = message.direction === 'outbound'
  const sentAt = new Date(message.createdDate)
  const sentLabel = Number.isNaN(sentAt.getTime())
    ? ''
    : format(sentAt, 'MMM d, h:mm a')
  const showToggle = message.text.length > 90

  return (
    <div className='flex flex-col gap-0.5 rounded-md px-2 py-1.5'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-start gap-2'>
          <Badge
            className={cn(
              'text-[10px] px-1.5 py-0 h-4 border shrink-0',
              isOutbound
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-green-100 text-green-700 border-green-200',
            )}
          >
            {isOutbound ? 'Sent' : 'Received'}
          </Badge>
          <p
            className={cn(
              'min-w-0 text-xs leading-4 text-gray-500 break-words',
              !isExpanded && 'line-clamp-1',
            )}
          >
            {message.text}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {showToggle ? (
            <button
              type='button'
              className='text-[10px] font-medium text-blue-600 hover:text-blue-700'
              onClick={() => setIsExpanded(value => !value)}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          ) : null}
          <span className='text-[10px] text-gray-500 w-22 text-right tabular-nums'>
            {sentLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmailActivityRow({ email }: { email: EmailHistory }) {
  const sentAt = new Date(email.sent_at)
  const sentLabel = Number.isNaN(sentAt.getTime())
    ? ''
    : format(sentAt, 'MMM d, h:mm a')
  const isSent = !!email.sender_user_id
  const isRead = isSent ? (email.read_count ?? 0) > 0 : !!email.employee_read_at
  const hasAttachments = !!email.has_attachments
  const snippet = makeEmailSnippet(email.body)

  return (
    <Link
      to={`/employee/emails/chat/${email.thread_id}`}
      className='group flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors'
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <Badge
            className={cn(
              'text-[10px] px-1.5 py-0 h-4 border shrink-0',
              isSent
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-green-100 text-green-700 border-green-200',
            )}
          >
            {isSent ? 'Sent' : 'Received'}
          </Badge>
          <span className='text-sm font-medium truncate'>
            {email.subject || '(no subject)'}
          </span>
        </div>
        <div className='flex items-center gap-1.5 shrink-0'>
          <span className='w-3 flex items-center justify-center'>
            {hasAttachments ? (
              <Paperclip
                className='h-3 w-3 text-gray-500'
                aria-label='Has attachments'
              />
            ) : null}
          </span>
          <span className='w-3 flex items-center justify-center'>
            {isRead ? (
              <Eye className='h-3 w-3 text-blue-500' aria-label='Read' />
            ) : (
              <EyeClosed className='h-3 w-3 text-gray-400' aria-label='Unread' />
            )}
          </span>
          <span className='text-[10px] text-gray-500 w-22 text-right tabular-nums'>
            {sentLabel}
          </span>
        </div>
      </div>
      {snippet ? (
        <p className='text-xs text-gray-500 line-clamp-1 break-words'>{snippet}</p>
      ) : null}
    </Link>
  )
}

function EmptyFiltered({
  filter,
  dateFrom,
  dateTo,
  onClearFilters,
  onClearDates,
}: {
  filter: CustomerActivityFilterType
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
  const noun = filter === 'sms' ? 'messages' : filter === 'emails' ? 'emails' : 'calls'

  return (
    <div className='flex flex-col items-center py-6 text-center'>
      <div className='text-sm text-slate-500'>
        No {filterLabel} {noun} found for this customer
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

function TimelineItem({
  icon: Icon,
  isLast = false,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  isLast?: boolean
  children: ReactNode
}) {
  return (
    <div className='flex gap-2.5'>
      <div className='flex flex-col items-center shrink-0'>
        <div className='flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 border border-gray-200'>
          <Icon className='h-4 w-4 text-gray-500' />
        </div>
        {!isLast && (
          <div className='flex-1 w-px border-l border-dashed border-gray-300 my-0.5' />
        )}
      </div>
      <div className='flex-1 min-w-0 pb-3'>{children}</div>
    </div>
  )
}

// Main component

export function CustomerActivityTimeline({
  phone,
  phone2,
  emails,
}: {
  phone: Nullable<string>
  phone2: Nullable<string>
  emails: EmailHistory[]
}) {
  const [filter, setFilter] = useState<CustomerActivityFilterType>('all')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const hasPhones = !!phone || !!phone2
  const hasActivitySource = hasPhones || emails.length > 0

  const customerPhoneDigits = useMemo(
    () =>
      [phone, phone2]
        .filter((p): p is string => !!p)
        .map(phoneDigitsOnly)
        .filter(d => d.length >= 10),
    [phone, phone2],
  )

  const callsQuery = useQuery<{ items: Calls200Response[] }>({
    queryKey: ['cloudtalk-customer-calls', phone, phone2],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (phone) qs.set('phone', phone)
      if (phone2) qs.set('phone2', phone2)
      const r = await fetch(`/api/cloudtalk/customerCalls?${qs}`)
      if (!r.ok) throw new Error(`CloudTalk ${r.status}`)
      return await r.json()
    },
    enabled: hasPhones,
    staleTime: 60_000,
  })

  const smsQuery = useQuery<{ items: SmsRow[]; customerPhoneDigits: string[] }>({
    queryKey: ['cloudtalk-customer-sms', phone, phone2],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (phone) qs.set('phone', phone)
      if (phone2) qs.set('phone2', phone2)
      const r = await fetch(`/api/cloudtalk/customerSms?${qs}`)
      if (!r.ok) throw new Error(`SMS ${r.status}`)
      return await r.json()
    },
    enabled: hasPhones,
    staleTime: 60_000,
  })

  const allCalls = useMemo(() => {
    const items = callsQuery.data?.items ?? []
    return items.map(mapToCallEntry)
  }, [callsQuery.data])

  const smsMessages = useMemo(() => {
    const rows = smsQuery.data?.items ?? []
    const digits = smsQuery.data?.customerPhoneDigits ?? customerPhoneDigits
    return rows
      .map(r => mapRowToSmsEntry(r, digits))
      .sort(
        (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
      )
  }, [smsQuery.data, customerPhoneDigits])

  const allItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []
    for (const c of allCalls) items.push({ type: 'call', data: c, date: c.startedAt })
    for (const message of smsMessages) {
      items.push({ type: 'sms', data: message, date: message.createdDate })
    }
    for (const email of emails) {
      items.push({ type: 'email', data: email, date: email.sent_at })
    }
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return items
  }, [allCalls, smsMessages, emails])

  const filteredItems = useMemo(() => {
    let result = allItems.filter(item => matchesItemFilter(item, filter))

    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      result = result.filter(i => new Date(i.date) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(i => new Date(i.date) <= to)
    }

    return result
  }, [allItems, filter, dateFrom, dateTo])

  const visibleItems = filteredItems.slice(0, visibleCount)
  const hasMore = visibleCount < filteredItems.length
  const hasActiveFilters =
    filter !== 'all' || dateFrom !== undefined || dateTo !== undefined

  const isFirstLoad =
    (callsQuery.isLoading || smsQuery.isLoading) && !callsQuery.data && !smsQuery.data
  const isBothErrored = callsQuery.isError && smsQuery.isError
  const isFetching = callsQuery.isFetching || smsQuery.isFetching

  const refetchAll = () => {
    callsQuery.refetch()
    smsQuery.refetch()
  }

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

  if (!hasActivitySource) {
    return (
      <div className='border rounded p-4'>
        <div className='text-md font-semibold mb-2'>Activity</div>
        <NoPhoneBanner />
        <EmptyGlobal />
      </div>
    )
  }

  if (isBothErrored) {
    return (
      <div className='border rounded p-4'>
        <div className='text-md font-semibold mb-2'>Activity</div>
        <ErrorState onRetry={refetchAll} />
      </div>
    )
  }

  if (isFirstLoad) {
    return (
      <div className='border rounded p-4'>
        <div className='text-md font-semibold mb-2'>Activity</div>
        <LoadingState />
      </div>
    )
  }

  if (allItems.length === 0) {
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
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === opt.value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
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

      {filteredItems.length === 0 && hasActiveFilters ? (
        <EmptyFiltered
          filter={filter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClearFilters={clearAllFilters}
          onClearDates={() => handlePreset('all')}
        />
      ) : (
        <>
          <ul>
            {visibleItems.map((item, index) => {
              const isLast = index === visibleItems.length - 1
              if (item.type === 'call') {
                return (
                  <li key={`call-${item.data.callId}`}>
                    <TimelineItem icon={Phone} isLast={isLast}>
                      <CallItemContent
                        call={item.data}
                        audioSrc={`/api/cloudtalk/userCallMedia/${item.data.callId}`}
                        compact
                        historyCompact
                      />
                    </TimelineItem>
                  </li>
                )
              }
              if (item.type === 'sms') {
                return (
                  <li key={`sms-${item.data.id}`}>
                    <TimelineItem icon={MessageSquare} isLast={isLast}>
                      <SmsActivityRow message={item.data} />
                    </TimelineItem>
                  </li>
                )
              }
              return (
                <li key={`email-${item.data.thread_id}-${item.data.id}`}>
                  <TimelineItem icon={Mail} isLast={isLast}>
                    <EmailActivityRow email={item.data} />
                  </TimelineItem>
                </li>
              )
            })}
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
