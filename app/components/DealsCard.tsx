import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CardContent } from '@/components/ui/card'
import type { DealCardData } from '~/types/deals'
import DealItem from './DealItem'

interface IProps {
  customers: DealCardData[]
  readonly?: boolean
  highlightedDealId?: number
}

export default function DealsCard({
  customers,
  readonly = false,
  highlightedDealId,
}: IProps) {
  return (
    <SortableContext
      items={customers.map(c => c.id)}
      strategy={verticalListSortingStrategy}
    >
      <CardContent className='flex flex-col space-y-2 overflow-y-auto p-2 '>
        {customers.map(c => (
          <DealItem
            key={c.id}
            deal={c}
            readonly={readonly}
            highlighted={highlightedDealId === c.id}
          />
        ))}
        {customers.length === 0 && (
          <p className='text-xs text-center text-slate-400'>No deals yet</p>
        )}
      </CardContent>
    </SortableContext>
  )
}
