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
    <div className='box-border flex min-w-93 md:min-w-65 flex-1 md:flex-1 xl:max-w-120 justify-start items-start px-2 max-md:shrink-0 max-md:snap-start max-md:snap-always md:flex-col md:px-0'>
      <Card
        ref={setNodeRef}
        className='flex  min-h-0 w-full  flex-col sm:min-w-50 md:max-w-none md:min-w-0'
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
    </div>
  )
}
