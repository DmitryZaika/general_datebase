import type { ColumnDef, Row } from '@tanstack/react-table'
import { format } from 'date-fns'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Image,
  Mail,
  MessageSquare,
  Phone,
  Trash2,
  User,
  UserPlus,
} from 'lucide-react'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import {
  Await,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
  useFetcher,
  useLoaderData,
} from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { DataTable } from '~/components/ui/data-table'
import { DataTablePagination } from '~/components/ui/data-table-pagination'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Skeleton } from '~/components/ui/skeleton'
import { db } from '~/db.server'
import { phoneDigitsOnly } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface SalesRep {
  id: number
  name: string
  email: string
  cloudtalk_agent_id: string | null
}

interface UserActivity {
  id: number
  source: string
  user_id: number | null
  user_name: string | null
  action: string
  created_at: string
  customer_name: string | null
}

interface GroupedUserActivity extends UserActivity {
  count: number
  groupKey: string
}

interface SmsActivityRow {
  id: number
  source: string
  user_id: number | null
  user_name: string | null
  action: string
  created_at: string
  sender: string
  recipient: string
}

interface CustomerPhoneRow {
  name: string
  phone: string | null
  phone_2: string | null
}

function lastPhoneDigits10(value: string | null | undefined): string | null {
  if (!value) return null
  const d = phoneDigitsOnly(value)
  if (d.length < 10) return null
  return d.slice(-10)
}

function buildCustomerLast10NameMap(rows: CustomerPhoneRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    for (const raw of [row.phone, row.phone_2]) {
      if (!raw) continue
      const key = lastPhoneDigits10(raw)
      if (key) map.set(key, row.name)
    }
  }
  return map
}

function customerNameForSmsParty(
  sender: string,
  recipient: string,
  last10ToName: Map<string, string>,
): string | null {
  const s = lastPhoneDigits10(sender)
  const r = lastPhoneDigits10(recipient)
  if (r) {
    const hit = last10ToName.get(r)
    if (hit) return hit
  }
  if (s) {
    const hit = last10ToName.get(s)
    if (hit) return hit
  }
  return null
}

type DatePreset = '1d' | '7d' | '30d' | '90d' | 'all'

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: '1d', label: '1d' },
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

function todayDate(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function getActivePreset(dateFrom?: Date, dateTo?: Date): DatePreset | null {
  if (!dateFrom && !dateTo) return 'all'
  if (!dateFrom) return null
  if (dateTo && isSameDay(dateFrom, startOfToday()) && isSameDay(dateTo, new Date()))
    return '1d'
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
      ? `${format(dateFrom, 'M/d/yyyy')} - ${format(dateTo, 'M/d/yyyy')}`
      : dateFrom
        ? `${format(dateFrom, 'M/d/yyyy')} - ...`
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

function GeneralActivitySortHeader({
  title,
  sortKey,
  sort,
  onToggle,
}: {
  title: string
  sortKey: string
  sort: { key: string | null; order: 'asc' | 'desc' }
  onToggle: (key: string) => void
}) {
  const isSorted = sort.key === sortKey
  const order = sort.order

  return (
    <Button
      variant='ghost'
      type='button'
      onClick={e => {
        e.stopPropagation()
        onToggle(sortKey)
      }}
      className='-ml-3 h-8 p-0 px-2 font-medium hover:bg-slate-100'
    >
      {title}
      {isSorted ? (
        order === 'asc' ? (
          <ArrowUp className='ml-2 h-4 w-4 text-slate-900' />
        ) : (
          <ArrowDown className='ml-2 h-4 w-4 text-slate-900' />
        )
      ) : (
        <ArrowUpDown className='ml-2 h-4 w-4 text-slate-400 opacity-50' />
      )}
    </Button>
  )
}

function compareActivityRows(
  a: UserActivity,
  b: UserActivity,
  sortKey: string,
  order: 'asc' | 'desc',
): number {
  let cmp = 0
  if (sortKey === 'created_at') {
    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  } else if (sortKey === 'customer_name') {
    const av = (a.customer_name ?? '').toLowerCase()
    const bv = (b.customer_name ?? '').toLowerCase()
    cmp = av < bv ? -1 : av > bv ? 1 : 0
  } else if (sortKey === 'user_name') {
    const av = (a.user_name ?? '').toLowerCase()
    const bv = (b.user_name ?? '').toLowerCase()
    cmp = av < bv ? -1 : av > bv ? 1 : 0
  } else if (sortKey === 'action') {
    const av = (a.action ?? '').toLowerCase()
    const bv = (b.action ?? '').toLowerCase()
    cmp = av < bv ? -1 : av > bv ? 1 : 0
  }
  return order === 'asc' ? cmp : -cmp
}

function ActivityActionIcon({
  action,
  iconClass = 'h-4 w-4 shrink-0 text-slate-500',
}: {
  action: string
  iconClass?: string
}) {
  if (action === 'Made a call') return <Phone className={iconClass} />
  if (action === 'Add Activity') return <ClipboardList className={iconClass} />
  if (action === 'Complete Activity') return <CheckCircle2 className={iconClass} />
  if (action === 'Delete Activity') return <Trash2 className={iconClass} />
  if (action === 'Sent email') return <Mail className={iconClass} />
  if (action === 'Sent a text') return <MessageSquare className={iconClass} />
  if (action === 'Add Note') return <FileText className={iconClass} />
  if (action === 'Delete Note') return <Trash2 className={iconClass} />
  if (action === 'Created deal') return <Briefcase className={iconClass} />
  if (action === 'Created customer') return <UserPlus className={iconClass} />
  if (action === 'Created user') return <UserPlus className={iconClass} />
  if (action === 'Added image to a deal') return <Image className={iconClass} />
  if (action === 'Added document') return <FileText className={iconClass} />

  return <ClipboardList className={iconClass} />
}

function ActivityActionCell({ action, count = 1 }: { action: string; count?: number }) {
  let label = action
  if (count > 1) {
    if (action === 'Added image to a deal') {
      label = `Added image to a deal (${count})`
    } else {
      label = `${action} (${count})`
    }
  }

  return (
    <div className='flex items-center gap-2'>
      <ActivityActionIcon action={action} />
      <span>{label}</span>
    </div>
  )
}

const ACTION_SUMMARY_ORDER = [
  'Made a call',
  'Sent a text',
  'Sent email',
  'Add Activity',
  'Complete Activity',
  'Add Note',
  'Created deal',
  'Created customer',
  'Added image to a deal',
  'Added document',
  'Delete Activity',
  'Delete Note',
  'Created user',
]

function countActivitiesByAction(items: UserActivity[]) {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item.action, (counts.get(item.action) ?? 0) + 1)
  }

  const summary: { action: string; count: number }[] = []
  for (const action of ACTION_SUMMARY_ORDER) {
    const count = counts.get(action)
    if (count && count > 0) {
      summary.push({ action, count })
    }
    counts.delete(action)
  }

  for (const [action, count] of counts.entries()) {
    if (count > 0) {
      summary.push({ action, count })
    }
  }

  return summary
}

function activityTimeGroupKey(createdAt: string) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return createdAt
  }
  return date.toLocaleString()
}

function buildActivityGroupKey(item: UserActivity) {
  const timeKey = activityTimeGroupKey(item.created_at)
  const customerKey = (item.customer_name ?? '').trim().toLowerCase()
  return `${timeKey}|${item.action}|${customerKey}`
}

function groupActivitiesByTimestamp(items: UserActivity[]): GroupedUserActivity[] {
  const order: string[] = []
  const groups = new Map<string, GroupedUserActivity>()

  for (const item of items) {
    const key = buildActivityGroupKey(item)
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      continue
    }
    order.push(key)
    groups.set(key, {
      ...item,
      count: 1,
      groupKey: key,
    })
  }

  return order.flatMap(key => {
    const group = groups.get(key)
    return group ? [group] : []
  })
}

function ActivitySummaryRow({ items }: { items: UserActivity[] }) {
  const summary = useMemo(() => countActivitiesByAction(items), [items])

  if (summary.length === 0) {
    return null
  }

  return (
    <div className='mb-3 flex flex-wrap gap-2'>
      {summary.map(({ action, count }) => (
        <div
          key={action}
          className='flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700'
        >
          <ActivityActionIcon action={action} />
          <span className='font-medium tabular-nums'>{count}</span>
        </div>
      ))}
    </div>
  )
}

function timeToAngle(createdAt: string) {
  const date = new Date(createdAt)
  return dateToClockAngle(date.getHours() % 12, date.getMinutes(), date.getSeconds())
}

function dateToHourHandAngle(date: Date) {
  const hours12 = date.getHours() % 12
  return ((hours12 + date.getMinutes() / 60) / 12) * 360 - 90
}

function dateToMinuteHandAngle(date: Date) {
  return ((date.getMinutes() + date.getSeconds() / 60) / 60) * 360 - 90
}

function dateToClockAngle(hours12: number, minutes: number, seconds: number) {
  const clockPosition = hours12 + minutes / 60 + seconds / 3600
  return (clockPosition / 12) * 360 - 90
}

function clockHandEnd(angleDeg: number, length: number) {
  return angleToPoint(angleDeg, length)
}

function angleToPoint(angleDeg: number, radius: number, center = 50) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: center + radius * Math.cos(rad),
    y: center + radius * Math.sin(rad),
  }
}

function describeClockArc(startAngle: number, endAngle: number, radius = 43) {
  let sweep = endAngle - startAngle
  while (sweep <= 0) {
    sweep += 360
  }
  if (sweep < 2) {
    return ''
  }
  const start = angleToPoint(startAngle, radius)
  const end = angleToPoint(startAngle + sweep, radius)
  const largeArc = sweep > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

const GAP_PADDING_DEG = 5
const GAP_THRESHOLD_MS = 2 * 60 * 60 * 1000
const ACTIVITY_OVERLAP_DEG = 12

type ActivityClockBundle = {
  id: string
  angle: number
  items: GroupedUserActivity[]
}

function angleDistance(first: number, second: number) {
  let diff = Math.abs(first - second)
  if (diff > 180) {
    diff = 360 - diff
  }
  return diff
}

function averageAngle(angles: number[]) {
  let x = 0
  let y = 0
  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180
    x += Math.cos(rad)
    y += Math.sin(rad)
  }
  return (Math.atan2(y, x) * 180) / Math.PI
}

function buildActivityBundles(
  items: GroupedUserActivity[],
  activityAngles: Map<string, number>,
): ActivityClockBundle[] {
  const bundles: ActivityClockBundle[] = items.map(item => ({
    id: item.groupKey,
    angle: activityAngles.get(item.groupKey) ?? timeToAngle(item.created_at),
    items: [item],
  }))

  let merged = true
  while (merged) {
    merged = false
    for (let index = 0; index < bundles.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < bundles.length; nextIndex += 1) {
        const current = bundles[index]
        const next = bundles[nextIndex]
        if (angleDistance(current.angle, next.angle) > ACTIVITY_OVERLAP_DEG) {
          continue
        }

        const combinedItems = [...current.items, ...next.items].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        bundles[index] = {
          id: current.id,
          items: combinedItems,
          angle: averageAngle(
            combinedItems.map(
              item => activityAngles.get(item.groupKey) ?? timeToAngle(item.created_at),
            ),
          ),
        }
        bundles.splice(nextIndex, 1)
        merged = true
        break
      }
      if (merged) {
        break
      }
    }
  }

  return bundles
}

function bundleTotalCount(items: GroupedUserActivity[]) {
  let total = 0
  for (const item of items) {
    total += item.count
  }
  return total
}

function formatActivityListTime(createdAt: string) {
  const date = new Date(createdAt)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function ActivityClockBundleMarker({ bundle }: { bundle: ActivityClockBundle }) {
  const pos = polarPosition(bundle.angle, 47)
  const primary = bundle.items[0]
  const totalCount = bundleTotalCount(bundle.items)
  const isBundled = bundle.items.length > 1

  return (
    <div
      className='group absolute z-10 -translate-x-1/2 -translate-y-1/2'
      style={{ left: pos.left, top: pos.top }}
    >
      <div className='relative'>
        {isBundled ? (
          <>
            <div className='absolute left-1 top-1 h-7 w-7 rounded-full border border-white bg-white shadow-sm ring-1 ring-slate-200' />
            <div className='absolute left-0.5 top-0.5 h-7 w-7 rounded-full border border-white bg-white shadow ring-1 ring-slate-200' />
          </>
        ) : null}
        <div
          className='relative flex h-7 w-7 items-center justify-center rounded-full border border-white bg-white shadow-md ring-1 ring-slate-200'
          title={
            isBundled
              ? undefined
              : `${primary.action}${primary.customer_name ? ` · ${primary.customer_name}` : ''}`
          }
        >
          <ActivityActionIcon
            action={primary.action}
            iconClass='h-3 w-3 shrink-0 text-slate-500'
          />
          {totalCount > 1 ? (
            <span className='absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-slate-800 px-0.5 text-[9px] font-medium text-white'>
              {totalCount}
            </span>
          ) : null}
        </div>
      </div>

      {isBundled ? (
        <div className='absolute bottom-full left-1/2 z-30 hidden min-w-[240px] -translate-x-1/2 pb-2 group-hover:block'>
          <div className='rounded-md border border-slate-200 bg-white p-2 shadow-lg'>
            <div className='max-h-48 space-y-1 overflow-y-auto'>
              {bundle.items.map(item => (
                <div
                  key={item.groupKey}
                  className='flex items-start gap-2 rounded px-1 py-1 text-xs text-slate-700 hover:bg-slate-50'
                >
                  <ActivityActionIcon
                    action={item.action}
                    iconClass='mt-0.5 h-3 w-3 shrink-0 text-slate-500'
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='font-medium'>
                      {item.action}
                      {item.count > 1 ? ` (${item.count})` : ''}
                    </div>
                    <div className='text-slate-500'>
                      {formatActivityListTime(item.created_at)}
                      {item.customer_name ? ` · ${item.customer_name}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function buildActivityGaps(
  items: GroupedUserActivity[],
  activityAngles: Map<string, number>,
) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const slots: GroupedUserActivity[] = []
  for (const item of sorted) {
    const previous = slots[slots.length - 1]
    if (
      previous &&
      activityTimeGroupKey(previous.created_at) ===
        activityTimeGroupKey(item.created_at)
    ) {
      continue
    }
    slots.push(item)
  }

  const gaps: { startAngle: number; endAngle: number }[] = []

  for (let index = 0; index < slots.length - 1; index += 1) {
    const current = slots[index]
    const next = slots[index + 1]
    const startMs = new Date(current.created_at).getTime()
    const endMs = new Date(next.created_at).getTime()
    if (endMs - startMs > GAP_THRESHOLD_MS) {
      gaps.push({
        startAngle:
          activityAngles.get(current.groupKey) ?? timeToAngle(current.created_at),
        endAngle: activityAngles.get(next.groupKey) ?? timeToAngle(next.created_at),
      })
    }
  }

  if (gaps.length > 1) {
    for (let index = 0; index < gaps.length; index += 1) {
      if (index > 0) {
        gaps[index].startAngle += GAP_PADDING_DEG
      }
      if (index < gaps.length - 1) {
        gaps[index].endAngle -= GAP_PADDING_DEG
      }
    }
  }

  return gaps
}

function polarPosition(angleDeg: number, radiusPercent: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    left: `${50 + radiusPercent * Math.cos(rad)}%`,
    top: `${50 + radiusPercent * Math.sin(rad)}%`,
  }
}

function buildActivityAngles(items: GroupedUserActivity[]) {
  const angles = new Map<string, number>()

  for (const item of items) {
    angles.set(item.groupKey, timeToAngle(item.created_at))
  }

  return angles
}

const CLOCK_HOUR_LABELS = Array.from({ length: 12 }, (_, index) => ({
  label: String(index === 0 ? 12 : index),
  angle: index * 30 - 90,
}))

function ActivityTimeline({ items }: { items: GroupedUserActivity[] }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const activityAngles = useMemo(() => buildActivityAngles(items), [items])
  const activityBundles = useMemo(
    () => buildActivityBundles(items, activityAngles),
    [items, activityAngles],
  )
  const activityGaps = useMemo(
    () => buildActivityGaps(items, activityAngles),
    [items, activityAngles],
  )

  const hourAngle = dateToHourHandAngle(now)
  const minuteAngle = dateToMinuteHandAngle(now)
  const hourHandEnd = clockHandEnd(hourAngle, 22)
  const minuteHandEnd = clockHandEnd(minuteAngle, 32)

  if (items.length === 0) {
    return null
  }

  return (
    <div className='mt-6 border-t border-slate-200 pt-6'>
      <div className='mx-auto flex w-[90%] flex-col items-center'>
        <div className='relative aspect-square w-full'>
          <div className='absolute inset-[10%] rounded-full border-[6px] border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-inner'>
            {Array.from({ length: 12 }).map((_, index) => {
              const angle = index * 30 - 90
              const pos = polarPosition(angle, 38)
              return (
                <div
                  key={`tick-${index}`}
                  className='absolute h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-slate-300'
                  style={{
                    left: pos.left,
                    top: pos.top,
                    transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                  }}
                />
              )
            })}

            {CLOCK_HOUR_LABELS.map(hour => {
              const pos = polarPosition(hour.angle, 30)
              return (
                <span
                  key={hour.label}
                  className='absolute -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500'
                  style={{ left: pos.left, top: pos.top }}
                >
                  {hour.label}
                </span>
              )
            })}

            <svg
              className='pointer-events-none absolute inset-0 z-[5]'
              viewBox='0 0 100 100'
            >
              <line
                x1='50'
                y1='50'
                x2={hourHandEnd.x}
                y2={hourHandEnd.y}
                stroke='#1e293b'
                strokeWidth='2.5'
                strokeLinecap='round'
              />
              <line
                x1='50'
                y1='50'
                x2={minuteHandEnd.x}
                y2={minuteHandEnd.y}
                stroke='#475569'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
              <circle
                cx='50'
                cy='50'
                r='2'
                fill='#1e293b'
                stroke='#ffffff'
                strokeWidth='1'
              />
            </svg>
          </div>

          <svg
            className='pointer-events-none absolute inset-0 h-full w-full'
            viewBox='0 0 100 100'
          >
            {activityGaps.map((gap, index) => {
              const path = describeClockArc(gap.startAngle, gap.endAngle)
              if (!path) {
                return null
              }
              return (
                <path
                  key={`gap-${index}`}
                  d={path}
                  fill='none'
                  stroke='#ef4444'
                  strokeWidth='1.75'
                  strokeLinecap='round'
                />
              )
            })}
          </svg>

          {activityBundles.map(bundle => (
            <ActivityClockBundleMarker
              key={bundle.items.map(item => item.groupKey).join('|')}
              bundle={bundle}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export const meta: MetaFunction = () => {
  return [{ title: 'Admin – Users Activity' }]
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: { company_id: number }
  try {
    const sessionUser = await getAdminUser(request)
    user = {
      company_id: sessionUser.company_id,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const companyId = user.company_id

  return { data: loadPageData(companyId) }
}

async function loadPageData(companyId: number) {
  const salesReps = await selectMany<SalesRep>(
    db,
    `SELECT u.id, u.name, u.email, u.cloudtalk_agent_id
      FROM users u
      JOIN users_positions up ON up.user_id = u.id
      JOIN positions p ON p.id = up.position_id
      WHERE u.is_deleted = 0
        AND LOWER(p.name) = 'sales_rep'
        AND u.company_id = ?
      ORDER BY u.name ASC`,
    [companyId],
  )

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0]

  const [
    dealActivityCreated,
    dealActivityDeleted,
    customerCreatedActivities,
    dealActivityCompleted,
    dealNotesList,
    dealNotesDeletedList,
    dealImagesActivities,
    dealDocumentsActivities,
    smsRows,
    emailActivities,
    userCreatedActivities,
    dealCreatedActivities,
    customerPhones,
  ] = await Promise.all([
    selectMany<UserActivity>(
      db,
      `SELECT
          da.id AS id,
          'deal_activity' AS source,
          COALESCE(u_creator.id, u_deal.id) AS user_id,
          COALESCE(u_creator.name, u_deal.name) AS user_name,
          CASE
            WHEN LOWER(da.name) LIKE '%text%' THEN 'Sent a text'
            ELSE 'Add Activity'
          END AS action,
          DATE_FORMAT(da.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deal_activities da
        LEFT JOIN deals d ON d.id = da.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_creator ON u_creator.company_id = da.company_id AND u_creator.is_deleted = 0
          AND da.created_by IS NOT NULL AND da.created_by != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(da.created_by))
        LEFT JOIN users u_deal ON u_deal.id = d.user_id AND u_deal.company_id = da.company_id AND u_deal.is_deleted = 0
        WHERE da.company_id = ? AND da.deleted_at IS NULL AND da.created_at >= ?`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          da.id AS id,
          'deal_activity_deleted' AS source,
          u_deal.id AS user_id,
          u_deal.name AS user_name,
          'Delete Activity' AS action,
          DATE_FORMAT(da.deleted_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deal_activities da
        LEFT JOIN deals d ON d.id = da.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_deal ON u_deal.id = d.user_id
          AND u_deal.company_id = da.company_id
          AND u_deal.is_deleted = 0
        WHERE da.company_id = ? AND da.deleted_at IS NOT NULL AND da.deleted_at >= ?`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          c.id AS id,
          'customer_created' AS source,
          u_creator.id AS user_id,
          COALESCE(
            u_creator.name,
            NULLIF(TRIM(c.created_by), '')
          ) AS user_name,
          'Created customer' AS action,
          DATE_FORMAT(c.created_date, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          c.name AS customer_name
        FROM customers c
        LEFT JOIN users u_creator ON u_creator.company_id = c.company_id AND u_creator.is_deleted = 0
          AND c.created_by IS NOT NULL AND TRIM(c.created_by) != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(c.created_by))
        WHERE c.company_id = ? AND c.deleted_at IS NULL AND c.created_date >= ?
          AND NOT (
            (c.created_by IS NULL OR TRIM(c.created_by) = '')
            AND LOWER(TRIM(IFNULL(c.source, ''))) = 'leads'
          )`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          da.id AS id,
          'deal_activity_completed' AS source,
          COALESCE(u_creator.id, u_deal.id) AS user_id,
          COALESCE(u_creator.name, u_deal.name) AS user_name,
          'Complete Activity' AS action,
          DATE_FORMAT(da.completed_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deal_activities da
        LEFT JOIN deals d ON d.id = da.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_creator ON u_creator.company_id = da.company_id AND u_creator.is_deleted = 0
          AND da.created_by IS NOT NULL AND da.created_by != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(da.created_by))
        LEFT JOIN users u_deal ON u_deal.id = d.user_id AND u_deal.company_id = da.company_id AND u_deal.is_deleted = 0
        WHERE da.company_id = ?
          AND da.deleted_at IS NULL
          AND da.is_completed = 1
          AND da.completed_at IS NOT NULL AND da.completed_at >= ?`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          dn.id AS id,
          'deal_note' AS source,
          u_deal.id AS user_id,
          u_deal.name AS user_name,
          'Add Note' AS action,
          DATE_FORMAT(dn.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deal_notes dn
        LEFT JOIN deals d ON d.id = dn.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_deal ON u_deal.id = d.user_id AND u_deal.company_id = dn.company_id AND u_deal.is_deleted = 0
        WHERE dn.company_id = ? AND dn.deleted_at IS NULL AND dn.created_at >= ?`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          dn.id AS id,
          'deal_note_deleted' AS source,
          u_deal.id AS user_id,
          u_deal.name AS user_name,
          'Delete Note' AS action,
          DATE_FORMAT(dn.deleted_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deal_notes dn
        LEFT JOIN deals d ON d.id = dn.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_deal ON u_deal.id = d.user_id AND u_deal.company_id = dn.company_id AND u_deal.is_deleted = 0
        WHERE dn.company_id = ? AND dn.deleted_at IS NOT NULL AND dn.deleted_at >= ?`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          di.id AS id,
          'deal_image' AS source,
          u_creator.id AS user_id,
          COALESCE(
            u_creator.name,
            NULLIF(TRIM(di.created_by), '')
          ) AS user_name,
          'Added image to a deal' AS action,
          DATE_FORMAT(di.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          COALESCE(
            (
              SELECT NULLIF(TRIM(c2.name), '')
              FROM customers c2
              WHERE c2.id = d.customer_id AND c2.company_id = ?
              LIMIT 1
            ),
            CONCAT('Deal #', CAST(d.id AS CHAR))
          ) AS customer_name
        FROM deals_images di
        JOIN deals d ON d.id = di.deal_id AND d.deleted_at IS NULL
        LEFT JOIN users u_creator ON u_creator.company_id = ? AND u_creator.is_deleted = 0
          AND di.created_by IS NOT NULL AND TRIM(di.created_by) != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(di.created_by))
        WHERE EXISTS (
          SELECT 1
          FROM customers c_scope
          WHERE c_scope.id = d.customer_id AND c_scope.company_id = ?
        ) AND di.created_at >= ?`,
      [companyId, companyId, companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          dd.id AS id,
          'deal_document' AS source,
          u_creator.id AS user_id,
          COALESCE(
            u_creator.name,
            NULLIF(TRIM(dd.created_by), '')
          ) AS user_name,
          'Added document' AS action,
          DATE_FORMAT(dd.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          COALESCE(
            (
              SELECT NULLIF(TRIM(c2.name), '')
              FROM customers c2
              WHERE c2.id = d.customer_id AND c2.company_id = ?
              LIMIT 1
            ),
            CONCAT('Deal #', CAST(d.id AS CHAR))
          ) AS customer_name
        FROM deals_documents dd
        JOIN deals d ON d.id = dd.deal_id AND d.deleted_at IS NULL
        LEFT JOIN users u_creator ON u_creator.company_id = ? AND u_creator.is_deleted = 0
          AND dd.created_by IS NOT NULL AND TRIM(dd.created_by) != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(dd.created_by))
        WHERE EXISTS (
          SELECT 1
          FROM customers c_scope
          WHERE c_scope.id = d.customer_id AND c_scope.company_id = ?
        ) AND dd.created_at >= ?`,
      [companyId, companyId, companyId, cutoffDate],
    ),
    selectMany<SmsActivityRow>(
      db,
      `SELECT
          cs.id AS id,
          'cloudtalk_sms' AS source,
          u.id AS user_id,
          u.name AS user_name,
          'Sent a text' AS action,
          DATE_FORMAT(cs.created_date, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          CAST(IFNULL(cs.sender, '') AS CHAR) AS sender,
          CAST(IFNULL(cs.recipient, '') AS CHAR) AS recipient
        FROM cloudtalk_sms cs
        JOIN users u ON u.cloudtalk_agent_id = cs.agent
        WHERE u.company_id = ? AND u.is_deleted = 0 AND cs.created_date >= ?
        ORDER BY cs.created_date DESC, cs.id DESC`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          e.id AS id,
          'email' AS source,
          e.sender_user_id AS user_id,
          u.name AS user_name,
          'Sent email' AS action,
          DATE_FORMAT(e.sent_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          COALESCE(
            c_deal.name,
            (
              SELECT c2.name FROM customers c2
              WHERE c2.company_id = u.company_id
                AND c2.deleted_at IS NULL
                AND (
                  LOWER(TRIM(IFNULL(c2.email, ''))) = LOWER(TRIM(IFNULL(e.receiver_email, '')))
                  OR LOWER(TRIM(IFNULL(c2.email, ''))) = LOWER(TRIM(IFNULL(e.sender_email, '')))
                )
              LIMIT 1
            ),
            NULLIF(TRIM(IFNULL(e.receiver_email, '')), ''),
            NULLIF(TRIM(IFNULL(e.sender_email, '')), '')
          ) AS customer_name
        FROM emails e
        JOIN users u ON u.id = e.sender_user_id
        LEFT JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers c_deal ON c_deal.id = d.customer_id AND c_deal.deleted_at IS NULL
        WHERE u.company_id = ? AND u.is_deleted = 0 AND e.deleted_at IS NULL AND e.sent_at >= ?
        ORDER BY e.sent_at DESC, e.id DESC`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          u_new.id AS id,
          'user_created' AS source,
          u_creator.id AS user_id,
          u_creator.name AS user_name,
          'Created user' AS action,
          DATE_FORMAT(u_new.created_date, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          u_new.name AS customer_name
        FROM users u_new
        LEFT JOIN users u_creator ON u_creator.company_id = u_new.company_id AND u_creator.is_deleted = 0
          AND u_new.created_by IS NOT NULL AND TRIM(u_new.created_by) != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(u_new.created_by))
        WHERE u_new.company_id = ? AND u_new.is_deleted = 0 AND u_new.created_date >= ?
          AND u_new.created_by IS NOT NULL AND TRIM(u_new.created_by) != ''`,
      [companyId, cutoffDate],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          d.id AS id,
          'deal_created' AS source,
          u_creator.id AS user_id,
          COALESCE(
            u_creator.name,
            NULLIF(TRIM(d.created_by), '')
          ) AS user_name,
          'Created deal' AS action,
          DATE_FORMAT(d.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deals d
        JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_creator ON u_creator.company_id = cust.company_id AND u_creator.is_deleted = 0
          AND d.created_by IS NOT NULL AND TRIM(d.created_by) != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(d.created_by))
        WHERE cust.company_id = ? AND d.deleted_at IS NULL AND d.created_at >= ?`,
      [companyId, cutoffDate],
    ),
    selectMany<CustomerPhoneRow>(
      db,
      `SELECT name, phone, phone_2
        FROM customers
        WHERE company_id = ? AND deleted_at IS NULL`,
      [companyId],
    ),
  ])

  const last10ToCustomerName = buildCustomerLast10NameMap(customerPhones)
  const smsActivities: UserActivity[] = smsRows.map(row => ({
    id: row.id,
    source: row.source,
    user_id: row.user_id,
    user_name: row.user_name,
    action: row.action,
    created_at: row.created_at,
    customer_name: customerNameForSmsParty(
      row.sender,
      row.recipient,
      last10ToCustomerName,
    ),
  }))

  const dealActivities = [
    ...dealActivityCreated,
    ...dealActivityDeleted,
    ...dealActivityCompleted,
    ...dealNotesList,
    ...dealNotesDeletedList,
    ...dealImagesActivities,
    ...dealDocumentsActivities,
    ...dealCreatedActivities,
  ]

  const activities = [
    ...dealActivities,
    ...userCreatedActivities,
    ...customerCreatedActivities,
    ...smsActivities,
    ...emailActivities,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return {
    salesReps,
    activities,
    companyId,
  }
}

const userActivityColumns: ColumnDef<GroupedUserActivity>[] = [
  {
    accessorKey: 'created_at',
    header: 'Date',
    cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
  },
  {
    accessorKey: 'action',
    header: 'Type of activity',
    cell: ({ row }) => (
      <ActivityActionCell action={row.original.action} count={row.original.count} />
    ),
  },
  {
    accessorKey: 'customer_name',
    header: 'Customer',
    cell: ({ row }) => row.original.customer_name || '-',
  },
]

export default function AdminUsersActivity() {
  const { data } = useLoaderData<typeof loader>()

  return (
    <Suspense fallback={<HydrateFallback />}>
      <Await resolve={data}>
        {({ salesReps, activities, companyId }) => (
          <ActivityContent
            salesReps={salesReps}
            activities={activities}
            companyId={companyId}
          />
        )}
      </Await>
    </Suspense>
  )
}

function ActivityContent({
  salesReps,
  activities,
  companyId,
}: {
  salesReps: SalesRep[]
  activities: UserActivity[]
  companyId: number
}) {
  const [selectedUser, setSelectedUser] = useState<SalesRep | null>(null)
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfToday())
  const [dateTo, setDateTo] = useState<Date | undefined>(todayDate())
  const [genPage, setGenPage] = useState(1)
  const [genPageSize, setGenPageSize] = useState(100)
  const [genSort, setGenSort] = useState<{ key: string | null; order: 'asc' | 'desc' }>(
    {
      key: 'created_at',
      order: 'desc',
    },
  )

  const callFetcher = useFetcher<{ activities: UserActivity[] }>({
    key: 'user-call-activities',
  })

  const callActivities = callFetcher.data?.activities ?? []

  useEffect(() => {
    if (selectedUser) {
      const params = new URLSearchParams()
      params.set('companyId', String(companyId))
      params.set('userId', String(selectedUser.id))
      callFetcher.load(`/api/users/activity/calls?${params.toString()}`)
    }
  }, [selectedUser, companyId, callFetcher])

  const toggleGenSort = useCallback((sortKey: string) => {
    setGenSort(prev =>
      prev.key === sortKey
        ? { key: sortKey, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key: sortKey, order: 'asc' },
    )
  }, [])

  const generalActivityColumns = useMemo((): ColumnDef<GroupedUserActivity>[] => {
    return [
      {
        accessorKey: 'created_at',
        enableSorting: false,
        header: () => (
          <GeneralActivitySortHeader
            title='Date'
            sortKey='created_at'
            sort={genSort}
            onToggle={toggleGenSort}
          />
        ),
        cell: ({ row }: { row: Row<GroupedUserActivity> }) =>
          new Date(row.original.created_at).toLocaleString(),
      },
      {
        accessorKey: 'customer_name',
        enableSorting: false,
        header: () => (
          <GeneralActivitySortHeader
            title='Customer'
            sortKey='customer_name'
            sort={genSort}
            onToggle={toggleGenSort}
          />
        ),
        cell: ({ row }: { row: Row<GroupedUserActivity> }) =>
          row.original.customer_name || '-',
      },
      {
        accessorKey: 'action',
        enableSorting: false,
        header: () => (
          <GeneralActivitySortHeader
            title='Type of activity'
            sortKey='action'
            sort={genSort}
            onToggle={toggleGenSort}
          />
        ),
        cell: ({ row }: { row: Row<GroupedUserActivity> }) => (
          <ActivityActionCell action={row.original.action} count={row.original.count} />
        ),
      },
      {
        accessorKey: 'user_name',
        enableSorting: false,
        header: () => (
          <GeneralActivitySortHeader
            title='User name'
            sortKey='user_name'
            sort={genSort}
            onToggle={toggleGenSort}
          />
        ),
        cell: ({ row }: { row: Row<GroupedUserActivity> }) =>
          row.original.user_name || '-',
      },
    ]
  }, [genSort, toggleGenSort])

  const sortedGeneralActivities = useMemo(() => {
    const result = [...activities]
    const key = genSort.key
    const order = genSort.order
    if (!key) {
      result.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      return result
    }
    result.sort((a, b) => compareActivityRows(a, b, key, order))
    return result
  }, [activities, genSort])

  const groupedGeneralActivities = useMemo(
    () => groupActivitiesByTimestamp(sortedGeneralActivities),
    [sortedGeneralActivities],
  )

  const genTotalPages = Math.max(
    1,
    Math.ceil(groupedGeneralActivities.length / genPageSize),
  )
  const genCurrentPage = Math.min(genPage, genTotalPages)
  const genStart = (genCurrentPage - 1) * genPageSize
  const generalTableRows = groupedGeneralActivities.slice(
    genStart,
    genStart + genPageSize,
  )

  const handlePreset = (preset: DatePreset) => {
    if (preset === 'all') {
      setDateFrom(undefined)
      setDateTo(undefined)
      return
    }
    if (preset === '1d') {
      setDateFrom(startOfToday())
      setDateTo(todayDate())
      return
    }
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
    setDateFrom(daysAgoDate(days))
    setDateTo(todayDate())
  }

  const selectedUserActivities = useMemo(() => {
    if (!selectedUser) return []
    const sid = selectedUser.id
    const sname = selectedUser.name.trim().toLowerCase()
    const filtered = activities
      .filter(item => {
        if (item.user_id === sid) return true
        const un = item.user_name?.trim().toLowerCase()
        return un !== undefined && un.length > 0 && un === sname
      })
      .filter(item => {
        const activityDate = new Date(item.created_at)
        if (dateFrom && activityDate < dateFrom) return false
        if (dateTo && activityDate > dateTo) return false
        return true
      })

    const dateFilteredCalls = callActivities.filter(item => {
      const activityDate = new Date(item.created_at)
      if (dateFrom && activityDate < dateFrom) return false
      if (dateTo && activityDate > dateTo) return false
      return true
    })

    return [...filtered, ...dateFilteredCalls].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [activities, selectedUser, dateFrom, dateTo, callActivities])

  const groupedSelectedUserActivities = useMemo(
    () => groupActivitiesByTimestamp(selectedUserActivities),
    [selectedUserActivities],
  )

  return (
    <PageLayout title='Sales Reps Activity'>
      <div className='animate-slide-up'>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
          {salesReps.map(rep => (
            <Button
              key={rep.id}
              type='button'
              variant='outline'
              className='h-48 flex-col gap-2'
              onClick={() => setSelectedUser(rep)}
            >
              <User className='h-6 w-6' />
              <span className='truncate text-sm'>{rep.name}</span>
            </Button>
          ))}
        </div>
        <div className='mt-6'>
          <div className='mb-2 text-xl font-medium text-center'>General activity</div>
          {activities.length === 0 ? (
            <div className='text-sm text-slate-500 text-center'>No activity yet</div>
          ) : (
            <>
              <DataTablePagination
                currentPage={genCurrentPage}
                totalPages={genTotalPages}
                pageSize={genPageSize}
                totalRows={groupedGeneralActivities.length}
                onPageChange={setGenPage}
                onPageSizeChange={size => {
                  setGenPageSize(size)
                  setGenPage(1)
                }}
              />
              <DataTable
                key={`${genCurrentPage}-${genPageSize}-${genSort.key}-${genSort.order}`}
                columns={generalActivityColumns}
                data={generalTableRows}
                getRowId={row => row.groupKey}
              />
              <DataTablePagination
                currentPage={genCurrentPage}
                totalPages={genTotalPages}
                pageSize={genPageSize}
                totalRows={groupedGeneralActivities.length}
                onPageChange={setGenPage}
                onPageSizeChange={size => {
                  setGenPageSize(size)
                  setGenPage(1)
                }}
              />
            </>
          )}
        </div>
        <Dialog
          open={selectedUser !== null}
          onOpenChange={open => {
            if (!open) setSelectedUser(null)
          }}
        >
          <DialogContent className='sm:max-w-[860px] max-h-[90vh] overflow-hidden'>
            <DialogHeader>
              <DialogTitle>
                {selectedUser ? `${selectedUser.name} activity` : 'User activity'}
              </DialogTitle>
            </DialogHeader>
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onRangeChange={range => {
                if (!range?.from) {
                  setDateFrom(undefined)
                  setDateTo(undefined)
                  return
                }
                setDateFrom(startOfDay(range.from))
                setDateTo(endOfDay(range.to || range.from))
              }}
              onPreset={handlePreset}
            />
            {selectedUserActivities.length === 0 && callFetcher.state !== 'loading' ? (
              <div className='text-sm text-slate-500'>No activity yet</div>
            ) : (
              <div className='h-[80vh] overflow-y-auto'>
                {callFetcher.state === 'loading' && (
                  <div className='mb-2 text-xs text-slate-400'>
                    Loading call history...
                  </div>
                )}
                <ActivitySummaryRow items={selectedUserActivities} />
                <DataTable
                  key={`${selectedUser?.id || 'none'}-${dateFrom?.toISOString() || 'all'}-${dateTo?.toISOString() || 'all'}`}
                  columns={userActivityColumns}
                  data={groupedSelectedUserActivities}
                  getRowId={row => row.groupKey}
                />
                <ActivityTimeline items={groupedSelectedUserActivities} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  )
}

export function HydrateFallback() {
  return (
    <PageLayout title='Sales Reps Activity'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className='h-48 w-full rounded-md border border-slate-200 flex flex-col items-center justify-center gap-2 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%] animate-shimmer'
          >
            <div className='h-6 w-6 rounded-full bg-slate-200' />
            <div className='h-4 w-20 rounded bg-slate-200' />
          </div>
        ))}
      </div>
      <div className='mt-6'>
        <div className='mb-2 text-xl font-medium text-center'>General activity</div>
        <div className='flex justify-between items-center mb-3'>
          <Skeleton className='h-8 w-32' />
          <Skeleton className='h-8 w-48' />
        </div>
        <div className='space-y-2'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center gap-3 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%] animate-shimmer rounded'
            >
              <div className='h-4 w-32 rounded bg-slate-200' />
              <div className='h-4 w-40 rounded bg-slate-200' />
              <div className='h-4 w-48 rounded bg-slate-200' />
              <div className='h-4 w-24 rounded bg-slate-200' />
            </div>
          ))}
        </div>
        <div className='flex justify-end mt-3'>
          <Skeleton className='h-8 w-48' />
        </div>
      </div>
    </PageLayout>
  )
}
