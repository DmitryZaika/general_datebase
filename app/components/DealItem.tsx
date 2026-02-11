import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import {
  AlertCircle,
  CalendarOff,
  Clock,
  GripVertical,
  Mail,
  PaperclipIcon,
  Pencil,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useFetcher, useLocation } from 'react-router'
import { cn } from '~/lib/utils'
import type { DealCardData } from '~/types/deals'
import { formatMoney, updateNumber } from './functions'

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
  const timeSuffix = hasTime ? ` ${format(date, 'HH:mm')}` : ''

  if (diffDays < 0) {
    return { color: 'text-red-600 bg-red-50', icon: 'alert', label: `${Math.abs(diffDays)}d overdue`, hasPill: true }
  }
  if (diffDays === 0) {
    return { color: 'text-orange-600 bg-orange-50', icon: 'clock', label: `Today${timeSuffix}`, hasPill: true }
  }
  if (diffDays === 1) {
    return { color: 'text-amber-600', icon: 'clock', label: `Tomorrow${timeSuffix}`, hasPill: false }
  }
  if (diffDays <= 2) {
    return { color: 'text-amber-600', icon: 'clock', label: format(date, 'MMM d') + timeSuffix, hasPill: false }
  }
  return { color: 'text-gray-500', icon: 'clock', label: format(date, 'MMM d') + timeSuffix, hasPill: false }
}

export default function DealItem({
  deal,
  readonly = false,
  highlighted = false,
}: DealItemProps) {
  const [editAmount, setEditAmount] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fetcher = useFetcher()
  const location = useLocation()
  const hasEmail = Boolean(deal.has_email)

  const hasImages =
    (Array.isArray(deal.images) && deal.images.length > 0) || Boolean(deal.has_images)

  const editBase = location.pathname.startsWith('/admin')
    ? '/admin/deals'
    : '/employee/deals'
  const fromState = `${location.pathname}${location.search}`
  const projectUrl = `${editBase}/edit/${deal.id}/project${location.search}`
  const mailUrl = readonly
    ? `${editBase}/edit/${deal.id}/history${location.search}`
    : `edit/${deal.id}/history`
  const imagesUrl = readonly
    ? `${editBase}/edit/${deal.id}/images${location.search}`
    : `edit/${deal.id}/images`

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: deal.id,
    data: { listId: deal.list_id, position: deal.position, type: 'deal' },
    disabled: readonly,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const deadlineInfo = deal.nearest_activity_deadline
    ? getActivityDeadlineInfo(deal.nearest_activity_deadline)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`deal-${deal.id}`}
      className={`relative flex-1 flex-col w-full border rounded-lg p-2 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-3 ${isSaving ? 'opacity-60' : ''} ${highlighted ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
      {...(!readonly ? attributes : {})}
      {...(!readonly ? listeners : {})}
    >
      <div className='flex items-center w-full gap-2'>
        <div
          className={`flex items-center gap-1 flex-1 ${readonly ? '' : 'cursor-grab'}`}
        >
          {!readonly && (
            <button
              className='touch-none cursor-grab opacity-50 hover:opacity-100 p-1'
              aria-label='Drag'
              onPointerDown={e => e.stopPropagation()}
            >
              <GripVertical className='w-4 h-4' />
            </button>
          )}
          {readonly ? (
            <Link
              to={projectUrl}
              className='text-xl font-medium truncate whitespace-normal flex-1 select-none hover:underline'
              onPointerDown={e => e.stopPropagation()}
            >
              {deal.company_name ? deal.company_name : deal.name}
            </Link>
          ) : (
            <h3 className='text-xl font-medium truncate whitespace-normal flex-1 select-none'>
              {deal.company_name ? deal.company_name : deal.name}
            </h3>
          )}
        </div>
        {!readonly && (
          <Link
            to={`edit/${deal.id}/project${location.search}`}
            className='absolute top-1 right-1 z-20'
            onPointerDown={e => e.stopPropagation()}
          >
            <Pencil
              size={16}
              className='w-5 h-5 flex-shrink-0 text-gray-500 hover:text-black'
            />
          </Link>
        )}
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

      {deal.nearest_activity_name ? (
        <p className='text-sm leading-5 text-slate-600 mt-1 truncate w-full'>
          {deal.nearest_activity_name}
        </p>
      ) : (
        <p className='text-xs text-slate-400 mt-1 italic'>No upcoming activities</p>
      )}

      {deal.status === 'Closed Lost' && deal.lost_reason && (
        <p className='text-xs text-slate-500 mt-1 break-words whitespace-pre-wrap'>
          {deal.lost_reason}
        </p>
      )}

      <div className='flex items-center gap-2 w-full'>
        <div className='mr-auto flex items-center'>
          {deadlineInfo ? (
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                deadlineInfo.color,
                deadlineInfo.hasPill && 'rounded-full px-2 py-0.5',
              )}
            >
              {deadlineInfo.icon === 'alert' ? (
                <AlertCircle className='w-3 h-3' />
              ) : (
                <Clock className='w-3 h-3' />
              )}
              {deadlineInfo.label}
            </span>
          ) : deal.nearest_activity_name ? (
            <span className='flex items-center gap-1 text-xs text-gray-400 italic'>
              <CalendarOff className='w-3 h-3' />
              No deadline
            </span>
          ) : null}
        </div>

        {(hasEmail || hasImages) && (
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
          </div>
        )}
      </div>
    </div>
  )
}
