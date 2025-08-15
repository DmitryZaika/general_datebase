import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, GripVertical, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import { formatMoney, updateNumber } from './functions'
import { Button } from './ui/button'

interface DealItemProps {
  deal: {
    id: number
    name: string
    amount?: number | null
    description?: string | null
    list_id: number
    position?: number | null
    due_date?: string | null
  }
  readonly?: boolean
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

export default function DealItem({ deal, readonly = false }: DealItemProps) {
  const [localDate, setLocalDate] = useState<string | null>(deal.due_date ?? null)
  const [editAmount, setEditAmount] = useState(false)
  const [editDesc, setEditDesc] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const descTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [pickerCoords, setPickerCoords] = useState<{
    top: number
    left: number
  } | null>(null)
  const fetcher = useFetcher()

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

  function openPicker(el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    setPickerCoords({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
    })
  }

  function resizeTextarea(el: HTMLTextAreaElement | null) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    if (pickerCoords && dateInputRef.current) {
      const el = dateInputRef.current
      el.showPicker ? el.showPicker() : el.focus()
    }
  }, [pickerCoords])

  useEffect(() => {
    if (editDesc) {
      resizeTextarea(descTextareaRef.current)
    }
  }, [editDesc])

  function formatDisplay(dateStr: string) {
    const d = parseLocal(dateStr)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex-1 flex-col w-full border rounded-lg p-2 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-3 ${isSaving ? 'opacity-60' : ''}`}
      {...(!readonly ? attributes : {})}
      {...(!readonly ? listeners : {})}
    >
      {/* Title row with drag handle and edit icon */}
      <div className='flex items-center w-full gap-2'>
        <div
          className={`flex items-center gap-2 flex-1 ${readonly ? '' : 'cursor-grab'}`}
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
            to={`edit/${deal.id}`}
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

      {/* Description inline edit */}
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
        <p
          className={`text-sm text-slate-500 mt-1 break-words whitespace-pre-wrap ${readonly ? '' : 'cursor-pointer'}`}
          onClick={() => !readonly && setEditDesc(true)}
          onPointerDown={e => e.stopPropagation()}
        >
          {deal.description}
        </p>
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

      {/* Date section */}
      {pickerCoords && (
        <input
          type='date'
          ref={dateInputRef}
          style={{
            position: 'fixed',
            top: `calc(${pickerCoords.top}px - 30px)`,
            left: `calc(${pickerCoords.left}px - 20px)`,
            zIndex: 1000,
            opacity: 0,
          }}
          defaultValue={localDate ?? ''}
          onChange={e => {
            console.log(e)
            const selected = e.currentTarget.value
            setPickerCoords(null)
            if (selected) submitDate(selected)
          }}
          onBlur={() => setPickerCoords(null)}
          autoFocus
        />
      )}
      {localDate ? (
        <p
          className={`text-sm font-medium cursor-pointer ${getDateColor(localDate, deal.list_id)}`}
          onClick={e => !readonly && openPicker(e.currentTarget)}
          onPointerDown={e => e.stopPropagation()}
          style={{ position: 'relative', zIndex: 20 }}
        >
          {formatDisplay(localDate)}
        </p>
      ) : (
        !readonly && (
          <Button
            variant='ghost'
            size='icon'
            className='h-3 w-3 p-2'
            onClick={e => openPicker(e.currentTarget)}
            onPointerDown={e => e.stopPropagation()}
            style={{ position: 'relative', zIndex: 20 }}
          >
            <Calendar className={`w-5 h-5 ${getDateColor(localDate, deal.list_id)}`} />
          </Button>
        )
      )}
    </div>
  )
}
