import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil } from 'lucide-react'
import { Link, useFetcher } from 'react-router'

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

  return (
    <div className='flex-1 flex-col w-full border rounded-lg p-3 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-3'>
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
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <Link
          ref={setNodeRef}
          style={style}
          to={`edit/${deal.id}`}
          className=''
          {...attributes}
          {...listeners}
        >
          <Pencil className='w-5 h-5 flex-shrink-0 text-gray-500 group-hover:text-black' />
        </Link>
      </div>
      <h3 className='text-xl font-medium truncate'>{deal.name}</h3>

      <div className='flex items-center gap-2'>
        <p className='text-sm font-medium'>Amount:</p>
        <p className='text-sm font-medium'>$ {deal.amount?.toLocaleString()}</p>
      </div>

      {deal.description && (
        <p className='text-sm text-slate-500 mt-1 break-words'>{deal.description}</p>
      )}
    </div>
  )
}
