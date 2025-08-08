import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Pencil } from 'lucide-react'
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
  lists: { id: number; name: string }[]
}

function parseLocal(dateInput: string | null | undefined): Date {
  if (!dateInput) return new Date(NaN)
  const dateStr = typeof dateInput === 'string' ? dateInput : ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return new Date(NaN)
  const [y, m, d] = parts.map(Number)
  return new Date(y, m - 1, d)
}
function getDateColor(dateStr: string | null | undefined): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selected = parseLocal(dateStr)
  if (isNaN(selected.getTime())) return 'text-gray-700'
  if (selected.getTime() === today.getTime()) return 'text-yellow-500'
  return selected < today ? 'text-red-500' : 'text-gray-500'
}

export default function DealItem({ deal, lists }: DealItemProps) {
  const [localDate, setLocalDate] = useState<string | null>(deal.due_date ?? null)
  const [editAmount, setEditAmount] = useState(false)
  const [editDesc, setEditDesc] = useState(false)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const [pickerCoords, setPickerCoords] = useState<{
    top: number
    left: number
  } | null>(null)
  const fetcher = useFetcher()

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: deal.id,
    data: { listId: deal.list_id, position: deal.position, type: 'deal' },
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

  useEffect(() => {
    if (pickerCoords && dateInputRef.current) {
      const el = dateInputRef.current
      // @ts-ignore
      el.showPicker ? el.showPicker() : el.focus()
    }
  }, [pickerCoords])

  function formatDisplay(dateStr: string) {
    const d = parseLocal(dateStr)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className='flex-1 flex-col w-full border rounded-lg p-2 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-3'
    >
      {/* Header with list selector & edit icon */}
      <div className='flex justify-between items-center w-full'>
        <div className='flex items-end gap-1'>
          <p className='text-md font-medium'>List:</p>
          <select
            className='text-xs border rounded px-1 mb-1'
            value={deal.list_id}
            onChange={e => {
              const newList = Number(e.target.value)
              if (newList === deal.list_id) return
              const fd = new FormData()
              fd.append('id', String(deal.id))
              fd.append('toList', String(newList))
              fetcher.submit(fd, { method: 'post', action: '/api/deals/change-list' })
              if (newList === 4 || newList === 5) {
                setLocalDate(null)
              }
            }}
          >
            {lists.map(l => (
              <option key={l.id} value={l.id} className='text-xs'>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <Link to={`edit/${deal.id}`}>
          <Pencil className='w-5 h-5 flex-shrink-0 text-gray-500 hover:text-black' />
        </Link>
      </div>

      {/* Deal name */}
      <h3 className='text-xl font-medium truncate whitespace-normal'>{deal.name}</h3>

      {/* Amount inline edit */}
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
            onBlur={e => {
              const fd = new FormData()
              fd.append('id', String(deal.id))
              fd.append('amount', updateNumber(e.currentTarget.value))
              fetcher.submit(fd, { method: 'post', action: '/api/deals/update-amount' })
              setEditAmount(false)
            }}
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
            onClick={() => setEditAmount(true)}
          >
            $ {formatMoney(deal.amount)}
          </p>
        )}
      </div>

      {/* Description inline edit */}
      {editDesc ? (
        <textarea
          className='border rounded p-1 w-full text-sm'
          defaultValue={deal.description ?? ''}
          autoFocus
          onFocus={e => e.currentTarget.select()}
          onBlur={e => {
            const fd = new FormData()
            fd.append('id', String(deal.id))
            fd.append('description', e.currentTarget.value.trim())
            fetcher.submit(fd, { method: 'post', action: '/api/deals/update-desc' })
            setEditDesc(false)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        />
      ) : (
        <p
          className='text-sm text-slate-500 mt-1 break-words whitespace-pre-wrap cursor-pointer'
          onClick={() => setEditDesc(true)}
        >
          {deal.description || 'Add description'}
        </p>
      )}

      {/* Date section */}
      {pickerCoords && (
        <input
          type='date'
          ref={dateInputRef}
          style={{
            position: 'fixed',
            top: pickerCoords.top,
            left: pickerCoords.left,
            zIndex: 1000,
          }}
          defaultValue={localDate ?? ''}
          onChange={e => {
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
          className={`text-sm font-medium cursor-pointer ${getDateColor(localDate)}`}
          onClick={e => openPicker(e.currentTarget)}
        >
          {formatDisplay(localDate)}
        </p>
      ) : (
        <Button
          variant='ghost'
          size='icon'
          className='h-3 w-3 p-2'
          onClick={e => openPicker(e.currentTarget)}
        >
          <Calendar className='w-5 h-5' />
        </Button>
      )}
    </div>
  )
}
