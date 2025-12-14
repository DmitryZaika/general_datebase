import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar as CalendarIcon, GripVertical, PaperclipIcon, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import { formatMoney, updateNumber } from './functions'
import { Button } from './ui/button'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface DealItemProps {
  deal: {
    id: number
    name: string
    amount?: number | null
    description?: string | null
    status?: string | null
    lost_reason?: string | null
    list_id: number
    position?: number | null
    due_date?: string | null
    images?: string[] | null
    has_images?: boolean
    sales_rep?: string | null
  }
  readonly?: boolean
  highlighted?: boolean
}

function parseLocal(dateInput: string | null | undefined): Date {
  if (!dateInput) return new Date(NaN)
  const dateStr = typeof dateInput === 'string' ? dateInput : ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return new Date(NaN)
  const [y, m, d] = parts.map(Number)
  return new Date(y, m - 1, d)
}
function getDateColor(dateStr: string | null | undefined, listId: number): string {
  if (!dateStr && listId !== 4 && listId !== 5) return 'text-red-500'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selected = parseLocal(dateStr)
  if (Number.isNaN(selected.getTime())) return 'text-gray-700'
  if (selected.getTime() === today.getTime()) return 'text-yellow-500'
  return selected < today ? 'text-red-500' : 'text-gray-500'
}

export default function DealItem({
  deal,
  readonly = false,
  highlighted = false,
}: DealItemProps) {
  const [localDate, setLocalDate] = useState<string | null>(deal.due_date ?? null)
  const [editAmount, setEditAmount] = useState(false)
  const [editDesc, setEditDesc] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const descTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const descDisplayRef = useRef<HTMLParagraphElement | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [descOverflow, setDescOverflow] = useState(false)
  const [lineHeightPx, setLineHeightPx] = useState<number>(20)
  const fetcher = useFetcher()

  const hasImages =
    (Array.isArray(deal.images) && deal.images.length > 0) || Boolean(deal.has_images)

  useEffect(() => {
    setLocalDate(deal.due_date ?? null)
  }, [deal.due_date])

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: deal.id,
    data: { listId: deal.list_id, position: deal.position, type: 'deal' },
    disabled: readonly,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  function submitDate(dateStr: string) {
    const fd = new FormData()
    fd.append('id', String(deal.id))
    fd.append('date', dateStr)
    fetcher.submit(fd, { method: 'post', action: '/api/deals/update-date' })
    setLocalDate(dateStr)
  }

  function resizeTextarea(el: HTMLTextAreaElement | null) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    if (editDesc) {
      resizeTextarea(descTextareaRef.current)
    }
  }, [editDesc])

  useEffect(() => {
    if (editDesc) return
    const el = descDisplayRef.current
    if (!el) return
    const styles = window.getComputedStyle(el)
    const lh = parseFloat(styles.lineHeight)
    const computedLineHeight = Number.isFinite(lh) ? lh : 20
    setLineHeightPx(computedLineHeight)
    const maxH = computedLineHeight * 4
    setDescOverflow(el.scrollHeight > maxH + 1)
  }, [deal.description, editDesc])

  function formatDisplay(dateStr: string) {
    const d = parseLocal(dateStr)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
  }

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
          <h3 className='text-xl font-medium truncate whitespace-normal flex-1 select-none'>
            {deal.name}
          </h3>
        </div>
        {!readonly && (
          <Link
            to={`edit/${deal.id}/project`}
            className='absolute top-1 right-1 z-20'
            onPointerDown={e => e.stopPropagation()}
          >
            <Pencil className='w-5 h-5 flex-shrink-0 text-gray-500 hover:text-black' />
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

      {editDesc ? (
        <textarea
          className='border rounded p-1  w-full text-sm'
          ref={descTextareaRef}
          defaultValue={deal.description ?? ''}
          autoFocus
          onFocus={e => e.currentTarget.select()}
          rows={1}
          style={{
            overflow: 'hidden',
            resize: 'none',
            position: 'relative',
            zIndex: 20,
          }}
          onInput={e => resizeTextarea(e.currentTarget)}
          onBlur={async e => {
            const fd = new FormData()
            fd.append('id', String(deal.id))
            fd.append('description', e.currentTarget.value.trim())
            setIsSaving(true)
            await fetcher.submit(fd, {
              method: 'post',
              action: '/api/deals/update-desc',
            })
            setIsSaving(false)
            setEditDesc(false)
          }}
          onPointerDown={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        />
      ) : deal.description ? (
        <div className='w-full'>
          <p
            ref={descDisplayRef}
            className={`text-sm leading-5 text-slate-500 mt-1 break-words whitespace-pre-wrap ${readonly ? '' : 'cursor-pointer'}`}
            onClick={() => !readonly && setEditDesc(true)}
            onPointerDown={e => e.stopPropagation()}
            style={{
              maxHeight: descExpanded ? 'none' : `${lineHeightPx * 4}px`,
              overflow: descExpanded ? 'visible' : 'hidden',
            }}
          >
            {deal.description}
          </p>
          {descOverflow && (
            <div className='mt-1'>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 px-2 text-xs'
                onClick={() => setDescExpanded(v => !v)}
                onPointerDown={e => e.stopPropagation()}
                style={{ position: 'relative', zIndex: 20 }}
              >
                {descExpanded ? 'Show less' : 'Show more'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        !readonly && (
          <p
            className='text-sm text-slate-500 mt-1 break-words whitespace-pre-wrap cursor-pointer'
            onClick={() => setEditDesc(true)}
            onPointerDown={e => e.stopPropagation()}
          >
            Add description
          </p>
        )
      )}

      {deal.status === 'Closed Lost' && deal.lost_reason && (
        <p className='text-xs text-slate-500 mt-1 break-words whitespace-pre-wrap'>
          {deal.lost_reason}
        </p>
      )}

      <div className='flex items-center justify-between gap-2 w-full'>
        {deal.list_id !== 5 && deal.list_id !== 4 && !readonly && (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                className={`text-sm font-medium cursor-pointer ${getDateColor(localDate, deal.list_id)}`}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              >
                {localDate ? (
                  formatDisplay(localDate)
                ) : (
                  <CalendarIcon className='w-4 h-4' />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start' side='bottom'>
              <Calendar
                fixedWeeks
                mode='single'
                selected={localDate ? new Date(localDate + 'T00:00:00') : undefined}
                defaultMonth={localDate ? new Date(localDate + 'T00:00:00') : undefined}
                onSelect={date => {
                  if (date) {
                    const year = date.getFullYear()
                    const month = String(date.getMonth() + 1).padStart(2, '0')
                    const day = String(date.getDate()).padStart(2, '0')
                    const dateStr = `${year}-${month}-${day}`
                    submitDate(dateStr)
                    setCalendarOpen(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        )}
        {deal.list_id !== 5 && deal.list_id !== 4 && readonly && localDate && (
          <p className={`text-sm font-medium ${getDateColor(localDate, deal.list_id)}`}>
            {formatDisplay(localDate)}
          </p>
        )}
        {hasImages && (
          <Link
            to={`edit/${deal.id}/images`}
            className='text-slate-500 hover:text-black'
            onPointerDown={e => e.stopPropagation()}
          >
            <PaperclipIcon className='w-4 h-4' />
          </Link>
        )}
      </div>
    </div>
  )
}
