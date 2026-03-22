import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import {
  AlertCircle,
  CalendarOff,
  Clock,
  ListTodo,
  Mail,
  PaperclipIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useFetcher, useLocation, useRevalidator } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { cn } from '~/lib/utils'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import { ActivityPriority } from '~/routes/api.deal-activities.$dealId'
import type { DealCardData } from '~/types/deals'
import { formatMoney, updateNumber } from './functions'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface DealItemProps {
  deal: DealCardData
  readonly?: boolean
  highlighted?: boolean
}

interface ActivityDeadlineInfo {
  color: string
  icon: 'alert' | 'clock'
  label: string
  hasPill: boolean
}

function getActivityDeadlineInfo(deadline: string): ActivityDeadlineInfo {
  const date = new Date(deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadlineDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((deadlineDay.getTime() - today.getTime()) / 86_400_000)
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  const timeSuffix = hasTime ? ` ${format(date, 'h:mm a')}` : ''

  if (diffDays < 0) {
    return {
      color: 'text-red-600 bg-red-50',
      icon: 'alert',
      label: `${Math.abs(diffDays)}d overdue`,
      hasPill: true,
    }
  }
  if (diffDays === 0) {
    return {
      color: 'text-orange-600 bg-orange-50',
      icon: 'clock',
      label: `Today${timeSuffix}`,
      hasPill: true,
    }
  }
  if (diffDays === 1) {
    return {
      color: 'text-amber-600',
      icon: 'clock',
      label: `Tomorrow${timeSuffix}`,
      hasPill: false,
    }
  }
  if (diffDays <= 2) {
    return {
      color: 'text-amber-600',
      icon: 'clock',
      label: format(date, 'MMM d') + timeSuffix,
      hasPill: false,
    }
  }
  return {
    color: 'text-gray-500',
    icon: 'clock',
    label: format(date, 'MMM d') + timeSuffix,
    hasPill: false,
  }
}

const ACTIVITY_PRIORITY_LABEL: Record<ActivityPriority, string> = {
  [ActivityPriority.High]: 'High',
  [ActivityPriority.Medium]: 'Medium',
  [ActivityPriority.Low]: 'Low',
}

const ACTIVITY_PRIORITY_WEIGHT: Record<ActivityPriority, number> = {
  [ActivityPriority.High]: 0,
  [ActivityPriority.Medium]: 1,
  [ActivityPriority.Low]: 2,
}

function sortActivities(activities: DealActivity[]): DealActivity[] {
  return [...activities].sort((a, b) => {
    const pw =
      ACTIVITY_PRIORITY_WEIGHT[a.priority] - ACTIVITY_PRIORITY_WEIGHT[b.priority]
    if (pw !== 0) return pw
    if (a.deadline && b.deadline)
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    return a.deadline ? -1 : b.deadline ? 1 : 0
  })
}

function formatActivityTime(deadline: string | null): string {
  if (!deadline) return '—'
  const d = new Date(deadline)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getActivityDueDateColor(deadline: string | null): string {
  if (!deadline) return 'text-gray-500'
  const d = new Date(deadline)
  if (Number.isNaN(d.getTime())) return 'text-gray-500'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadlineDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (deadlineDate.getTime() < today.getTime()) return 'text-red-600'
  if (deadlineDate.getTime() === today.getTime()) return 'text-yellow-600'
  return 'text-gray-500'
}

function activityPriorityForApi(value: string | null | undefined): string {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}

export default function DealItem({
  deal,
  readonly = false,
  highlighted = false,
}: DealItemProps) {
  const [editAmount, setEditAmount] = useState(false)
  const [editDueDate, setEditDueDate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activityExpanded, setActivityExpanded] = useState(false)
  const [activitiesOpen, setActivitiesOpen] = useState(false)
  const [noActiveActivitiesAfterLoad, setNoActiveActivitiesAfterLoad] = useState(false)
  const activityRef = useRef<HTMLParagraphElement>(null)
  const activitiesCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isActivityTruncated, setIsActivityTruncated] = useState(false)
  const pendingActivityDeadlineSyncRef = useRef(false)
  const fetcher = useFetcher()
  const revalidator = useRevalidator()
  const csrfToken = useAuthenticityToken()
  const activitiesFetcher = useFetcher<{
    activities?: DealActivity[]
    error?: string | null
  }>()
  const location = useLocation()
  const hasEmail = Boolean(deal.has_email)

  const scheduleActivitiesClose = useCallback(() => {
    if (activitiesCloseTimeoutRef.current)
      clearTimeout(activitiesCloseTimeoutRef.current)
    activitiesCloseTimeoutRef.current = setTimeout(() => setActivitiesOpen(false), 200)
  }, [])

  const cancelActivitiesClose = useCallback(() => {
    if (activitiesCloseTimeoutRef.current) {
      clearTimeout(activitiesCloseTimeoutRef.current)
      activitiesCloseTimeoutRef.current = null
    }
  }, [])

  const handleActivitiesOpen = useCallback(() => {
    cancelActivitiesClose()
    setActivitiesOpen(true)
    activitiesFetcher.load(`/api/deal-activities/${deal.id}`)
  }, [deal.id, cancelActivitiesClose])

  const hasImages =
    (Array.isArray(deal.images) && deal.images.length > 0) || Boolean(deal.has_images)

  const isWon = deal.is_won === 1
  const isLost = deal.is_won === 0
  const isClosed = isWon || isLost
  const hasLostReason = isLost && Boolean(deal.lost_reason)

  const editBase = location.pathname.startsWith('/admin')
    ? '/admin/deals'
    : '/employee/deals'
  const fromState = `${location.pathname}${location.search}`
  const projectUrl = `${editBase}/edit/${deal.id}/project${location.search}`
  const mailUrl = readonly
    ? `${editBase}/edit/${deal.id}/history`
    : `edit/${deal.id}/history`
  const imagesUrl = readonly
    ? `${editBase}/edit/${deal.id}/images`
    : `edit/${deal.id}/images`

  useEffect(() => {
    setNoActiveActivitiesAfterLoad(false)
  }, [deal.id])

  useEffect(() => {
    if (fetcher.state !== 'idle' || !pendingActivityDeadlineSyncRef.current) return
    pendingActivityDeadlineSyncRef.current = false
    setIsSaving(false)
    revalidator.revalidate()
  }, [fetcher.state, revalidator])

  const activeActivitiesCount =
    activitiesFetcher.state === 'idle' && activitiesFetcher.data?.activities
      ? (activitiesFetcher.data.activities as DealActivity[]).filter(
          a => !a.is_completed,
        ).length
      : null

  useEffect(() => {
    if (activeActivitiesCount === 0) setNoActiveActivitiesAfterLoad(true)
  }, [activeActivitiesCount])

  const showActivitiesIcon =
    Boolean(deal.has_activities) && !noActiveActivitiesAfterLoad

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: deal.id,
    data: { listId: deal.list_id, position: deal.position, type: 'deal' },
    disabled: readonly,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    const el = activityRef.current
    if (el) {
      // Check if truncated in collapsed state (line-clamp-2)
      // or if we are already expanded (in which case we should show "show less")
      const isOverflowing = el.scrollHeight > el.clientHeight
      setIsActivityTruncated(isOverflowing || activityExpanded)
    }
  }, [deal.nearest_activity_name, activityExpanded])

  const deadlineInfo = deal.nearest_activity_deadline
    ? getActivityDeadlineInfo(deal.nearest_activity_deadline)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`deal-${deal.id}`}
      className={`relative flex-1 flex-col w-full border rounded-lg p-2 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-3 ${isSaving ? 'opacity-60' : ''} ${highlighted ? 'ring-2 ring-blue-400 bg-blue-50' : ''} ${!readonly ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...(!readonly ? attributes : {})}
      {...(!readonly ? listeners : {})}
    >
      <div className='flex items-center w-full gap-2'>
        <div className='flex items-center gap-1 flex-1'>
          <Link
            to={projectUrl}
            className='text-xl font-medium truncate whitespace-normal flex-1 select-none hover:underline'
            onPointerDown={e => e.stopPropagation()}
          >
            {deal.company_name ? deal.company_name : deal.name}
          </Link>
        </div>
      </div>

      <div className='flex items-center gap-2 w-full'>
        <p className='text-sm font-medium'>Amount:</p>
        {editAmount ? (
          <input
            className='border rounded px-1 text-sm w-24'
            onFocus={(e: React.FocusEvent<HTMLInputElement>) =>
              e.currentTarget.select()
            }
            defaultValue={formatMoney(deal.amount)}
            autoFocus
            onBlur={async e => {
              const fd = new FormData()
              fd.append('id', String(deal.id))
              fd.append('amount', updateNumber(e.currentTarget.value))
              setIsSaving(true)
              await fetcher.submit(fd, {
                method: 'post',
                action: '/api/deals/update-amount',
              })
              setIsSaving(false)
              setEditAmount(false)
            }}
            onPointerDown={e => e.stopPropagation()}
            style={{ position: 'relative', zIndex: 20 }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
          />
        ) : (
          <p
            className='text-sm font-medium cursor-pointer'
            onClick={() => !readonly && setEditAmount(true)}
            onPointerDown={e => e.stopPropagation()}
          >
            $ {formatMoney(deal.amount)}
          </p>
        )}
      </div>

      {deal.sales_rep && (
        <div className='absolute top-1 right-2 text-xs text-gray-500'>
          {deal.sales_rep}
        </div>
      )}

      {!isClosed &&
        (deal.nearest_activity_name ? (
          <div className='w-full mt-1'>
            <p
              ref={activityRef}
              className={cn(
                'text-sm leading-5 text-slate-600 w-full',
                !activityExpanded ? 'line-clamp-2' : 'whitespace-pre-wrap',
              )}
            >
              {deal.nearest_activity_name}
            </p>
            {isActivityTruncated && (
              <button
                type='button'
                className='text-xs text-slate-400 hover:text-slate-600 underline decoration-dotted mt-0.5'
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  setActivityExpanded(prev => !prev)
                }}
              >
                {activityExpanded ? 'show less' : 'show more'}
              </button>
            )}
          </div>
        ) : (
          <p className='text-xs text-red-500 font-semibold mt-1 italic'>
            No upcoming activities
          </p>
        ))}

      {hasLostReason && (
        <p className='text-xs text-slate-500 mt-1 break-words whitespace-pre-wrap'>
          {deal.lost_reason}
        </p>
      )}

      <div className='flex items-center gap-2 w-full'>
        <div className='mr-auto flex items-center'>
          {!isClosed && deal.nearest_activity_name && (
            <Popover open={editDueDate} onOpenChange={setEditDueDate}>
              <PopoverTrigger asChild>
                {deadlineInfo ? (
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium cursor-pointer hover:opacity-80',
                      deadlineInfo.color,
                      deadlineInfo.hasPill && 'rounded-full px-2 py-0.5',
                    )}
                    onClick={e => {
                      if (!readonly) {
                        e.stopPropagation()
                        setEditDueDate(true)
                      }
                    }}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    {deadlineInfo.icon === 'alert' ? (
                      <AlertCircle className='w-3 h-3' />
                    ) : (
                      <Clock className='w-3 h-3' />
                    )}
                    {deadlineInfo.label}
                  </span>
                ) : (
                  <span
                    className='flex items-center gap-1 text-xs text-gray-400 italic cursor-pointer hover:text-gray-600'
                    onClick={e => {
                      if (!readonly) {
                        e.stopPropagation()
                        setEditDueDate(true)
                      }
                    }}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    <CalendarOff className='w-3 h-3' />
                    No deadline
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='start'>
                <Calendar
                  mode='single'
                  selected={
                    deal.nearest_activity_deadline
                      ? new Date(deal.nearest_activity_deadline)
                      : undefined
                  }
                  onSelect={(date: Date | undefined) => {
                    if (!deal.nearest_activity_id || date === undefined) return
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const fd = new FormData()
                    fd.append('intent', 'update')
                    fd.append('activityId', String(deal.nearest_activity_id))
                    fd.append('name', deal.nearest_activity_name || '')
                    fd.append('deadline', dateStr)
                    fd.append(
                      'priority',
                      activityPriorityForApi(deal.nearest_activity_priority),
                    )
                    fd.append('csrf', csrfToken)
                    pendingActivityDeadlineSyncRef.current = true
                    setIsSaving(true)
                    setEditDueDate(false)
                    fetcher.submit(fd, {
                      method: 'post',
                      action: `/api/deal-activities/${deal.id}`,
                    })
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className='flex items-center gap-2'>
          {hasEmail && (
            <Link
              to={mailUrl + location.search}
              className='text-slate-500 hover:text-black'
              onPointerDown={e => e.stopPropagation()}
              state={{ from: fromState }}
            >
              <Mail className='w-4 h-4' />
            </Link>
          )}
          {hasImages && (
            <Link
              to={imagesUrl + location.search}
              className='text-slate-500 hover:text-black'
              onPointerDown={e => e.stopPropagation()}
              state={{ from: fromState }}
            >
              <PaperclipIcon className='w-4 h-4' />
            </Link>
          )}
          {showActivitiesIcon && (
            <Popover open={activitiesOpen} onOpenChange={setActivitiesOpen}>
              <PopoverTrigger asChild>
                <Link
                  to={projectUrl + location.search}
                  state={{ from: fromState }}
                  className='cursor-pointer hover:opacity-80'
                  onPointerDown={e => e.stopPropagation()}
                  onPointerEnter={handleActivitiesOpen}
                  onPointerLeave={scheduleActivitiesClose}
                >
                  <ListTodo className='w-4 h-4 text-slate-500' />
                </Link>
              </PopoverTrigger>
              <PopoverContent
                className='w-72 max-h-64 overflow-y-auto p-2'
                align='end'
                side='bottom'
                onPointerEnter={cancelActivitiesClose}
                onPointerLeave={scheduleActivitiesClose}
                onOpenAutoFocus={e => e.preventDefault()}
                onPointerDown={e => e.stopPropagation()}
              >
                <p className='text-xs font-semibold text-slate-700 mb-2'>Activities</p>
                {activitiesFetcher.state === 'loading' && (
                  <p className='text-xs text-slate-500'>Loading…</p>
                )}
                {activitiesFetcher.state !== 'loading' &&
                  (() => {
                    const all = (activitiesFetcher.data?.activities ??
                      []) as DealActivity[]
                    const active = sortActivities(all.filter(a => !a.is_completed))
                    return active.length ? (
                      <ul className='space-y-2'>
                        {active.map((a: DealActivity) => (
                          <li
                            key={a.id}
                            className='text-xs border-b border-slate-100 last:border-0 pb-1.5 last:pb-0'
                          >
                            <p>{a.name}</p>
                            <div className='flex items-center gap-1.5 mt-0.5 flex-wrap'>
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                  a.priority === ActivityPriority.High
                                    ? 'bg-red-100 text-red-700 border-red-200'
                                    : a.priority === ActivityPriority.Medium
                                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                                      : 'bg-gray-100 text-gray-600 border-gray-200'
                                }`}
                              >
                                {ACTIVITY_PRIORITY_LABEL[a.priority]}
                              </span>
                              {a.deadline && (
                                <span
                                  className={`text-[10px] ${getActivityDueDateColor(a.deadline)}`}
                                >
                                  {formatActivityTime(a.deadline)}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className='text-xs text-slate-500'>No activities</p>
                    )
                  })()}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  )
}
