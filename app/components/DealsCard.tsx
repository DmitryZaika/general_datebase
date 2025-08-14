import { CardContent } from '@/components/ui/card'
import DealItem from './DealItem'

interface IProps {
  customers: ExtendedCustomer[]
  readonly?: boolean
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

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

export default function DealsCard({ customers, readonly = false }: IProps) {
  return (
    <SortableContext
      items={customers.map(c => c.id)}
      strategy={verticalListSortingStrategy}
    >
      <CardContent className='p-2 flex-col overflow-y-auto space-y-2 w-full min-h-[40px]'>
        {customers.map(c => (
          <DealItem key={c.id} deal={c} readonly={readonly} />
        ))}
        {customers.length === 0 && (
          <p className='text-xs text-center text-slate-400'>No deals yet</p>
        )}
      </CardContent>
    </SortableContext>
  )
}
