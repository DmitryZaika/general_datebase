import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useFetcher } from 'react-router'
import { replaceZero } from './functions'

interface DealItemProps {
  deal: {
    id: number
    name: string
    amount?: number
    description?: string
    list_id: number
    position?: number
  }
  lists: { id: number; name: string }[]
}

export default function DealItem({ deal, lists }: DealItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: deal.id,
    data: { listId: deal.list_id, position: deal.position, type: 'deal' },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const fetcher = useFetcher()
  const [editDesc, setEditDesc] = useState(false)
  const [editAmount, setEditAmount] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className='flex-1 flex-col w-full border rounded-lg p-2 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-3'
    >
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
            }}
          >
            {lists.map(l => (
              <option className='' key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <Link to={`edit/${deal.id}`} className=''>
          <Pencil className='w-5 h-5 flex-shrink-0 text-gray-500 group-hover:text-black' />
        </Link>
      </div>
      <h3 className='text-xl font-medium truncate whitespace-normal'>{deal.name}</h3>

      <div className='flex items-center gap-2 w-full'>
        <p className='text-sm font-medium'>Amount:</p>
        {editAmount ? (
          <input
            className='border rounded px-1 text-sm w-24'
            onFocus={e => (e.target as HTMLInputElement).select()}
            defaultValue={replaceZero(deal.amount?.toLocaleString() || '0')}
            autoFocus
            onBlur={e => {
              const fd = new FormData()
              fd.append('id', String(deal.id))
              fd.append('amount', e.currentTarget.value)
              fetcher.submit(fd, { method: 'post', action: '/api/deals/update-amount' })
              setEditAmount(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
          />
        ) : (
          <p
            className='text-sm font-medium cursor-pointer'
            onClick={() => setEditAmount(true)}
          >
            $ {replaceZero(deal.amount?.toLocaleString() || '0')}
          </p>
        )}
      </div>

      {editDesc ? (
        <textarea
          className='border rounded p-1 w-full text-sm'
          defaultValue={deal.description ?? ''}
          autoFocus
          onFocus={e => (e.target as HTMLTextAreaElement).select()}
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
              ;(e.target as HTMLTextAreaElement).blur()
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

      {/* <Button variant='ghost' size='icon' className='h-3 w-3 p-2'>
        <Calendar className='w-5 h-5' />
      </Button> */}
    </div>
  )
}
