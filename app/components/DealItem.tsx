import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil } from 'lucide-react'
import { Link } from 'react-router'

interface DealItemProps {
  deal: {
    id: number
    name: string
    amount?: number
    description?: string
    list_id: number
    position?: number
  }
}

export default function DealItem({ deal }: DealItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: deal.id,
    data: { listId: deal.list_id, position: deal.position },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Link
      ref={setNodeRef}
      style={style}
      to={`edit/${deal.id}`}
      className='bg-white w-full border rounded-lg p-3 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-3'
      {...attributes}
      {...listeners}
    >
      <div className='flex-1'>
        <h3 className='text-xl font-medium truncate'>{deal.name}</h3>
        {typeof deal.amount !== 'undefined' && (
          <div className='flex items-center gap-2'>
            <p className='text-sm font-medium'>Amount:</p>
            <p className='text-sm font-medium'>$ {deal.amount.toLocaleString()}</p>
          </div>
        )}
        {deal.description && (
          <p className='text-sm text-slate-500 mt-1 break-words'>{deal.description}</p>
        )}
      </div>
      <Pencil className='w-4 h-4 flex-shrink-0 text-gray-500 group-hover:text-black' />
    </Link>
  )
}
