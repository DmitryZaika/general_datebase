import { useDroppable } from '@dnd-kit/core'
import type { DealCardData } from '~/types/deals'
import DealsCard from './DealsCard'
import { Card, CardHeader, CardTitle } from './ui/card'

interface DealsListProps {
  title: string
  customers: DealCardData[]
  id: number
  readonly?: boolean
  highlightedDealId?: number
}

export default function DealsList({
  title,
  customers,
  id,
  readonly = false,
  highlightedDealId,
}: DealsListProps) {
  const { setNodeRef } = useDroppable({
    id: `list-${id}`,
    data: { type: 'list', listId: id },
    disabled: readonly,
  })

  return (
    <Card
      ref={setNodeRef}
      className={`min-w-[18rem] max-w-[22rem] flex-1 w-full max-h-[calc(100vh-10rem)] flex flex-col h-full shadow-sm `}
    >
      <CardHeader className='bg-black rounded-t-xl py-2 px-3'>
        <div className='flex justify-between items-center'>
          <CardTitle className='text-sm font-semibold tracking-wide text-white w-full'>
            {title}
          </CardTitle>
          <span className='text-xs font-medium text-white/90 bg-white/20 rounded-full px-2 py-0.5'>
            {customers.length}
          </span>
        </div>
      </CardHeader>
      <DealsCard
        customers={customers}
        readonly={readonly}
        highlightedDealId={highlightedDealId}
      />
    </Card>
  )
}
