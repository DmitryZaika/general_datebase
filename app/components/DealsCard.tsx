import { CardContent } from '@/components/ui/card'
import DealItem from './DealItem'

interface IProps {
  customers: ExtendedCustomer[]
  lists: { id: number; name: string }[]
  listId: number
}

interface ExtendedCustomer {
  id: number
  name: string
  amount?: number | null
  description?: string | null
  list_id: number
  position?: number
  due_date?: string | null
}

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

export default function DealsCard({ customers, lists, listId }: IProps) {
  const { setNodeRef } = useDroppable({ id: listId })

  return (
    <SortableContext
      items={customers.map(c => c.id)}
      strategy={verticalListSortingStrategy}
    >
      <CardContent
        ref={setNodeRef}
        className='p-2 flex-col overflow-y-auto space-y-2 w-full min-h-[40px]'
      >
        {customers.map(c => (
          <DealItem key={c.id} deal={c} lists={lists} />
        ))}
        {customers.length === 0 && (
          <p className='text-xs text-center text-slate-400'>No deals yet</p>
        )}
      </CardContent>
    </SortableContext>
  )
}
