import { useDroppable } from '@dnd-kit/core'
import { motion, type Variants } from 'framer-motion'
import type { DealCardData } from '~/types/deals'
import DealsCard from './DealsCard'
import { Card, CardHeader, CardTitle } from './ui/card'

interface DealsListProps {
  title: string
  customers: DealCardData[]
  id: number
  readonly?: boolean
  highlightedDealId?: number
  columnMotionVariants?: Variants
}

const LIST_OUTER_CLASS =
  'box-border flex min-w-93 flex-1 items-start justify-start px-2 max-md:w-full max-md:shrink-0 max-md:snap-start max-md:snap-always md:min-w-65 md:flex-1 md:flex-col md:px-0 xl:max-w-120 '

export default function DealsList({
  title,
  customers,
  id,
  readonly = false,
  highlightedDealId,
  columnMotionVariants,
}: DealsListProps) {
  const { setNodeRef } = useDroppable({
    id: `list-${id}`,
    data: { type: 'list', listId: id },
    disabled: readonly,
  })

  const listCard = (
    <Card
      ref={columnMotionVariants ? undefined : setNodeRef}
      className='flex w-full flex-col sm:min-w-50 md:max-w-none'
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

  if (columnMotionVariants) {
    return (
      <motion.div
        ref={setNodeRef}
        variants={columnMotionVariants}
        className={LIST_OUTER_CLASS}
      >
        {listCard}
      </motion.div>
    )
  }

  return <div className={LIST_OUTER_CLASS}>{listCard}</div>
}
