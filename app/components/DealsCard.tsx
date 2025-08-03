import { CardContent } from '@/components/ui/card'
import DealItem from './DealItem'

interface IProps {
  customers: ExtendedCustomer[]
  lists: { id: number; name: string }[]
}

interface ExtendedCustomer {
  id: number
  name: string
  amount?: number
  description?: string
  list_id: number
  position?: number
}

export default function DealsCard({ customers, lists }: IProps) {
  return (
    <CardContent className='p-4 flex-col overflow-y-auto space-y-2 w-full'>
      {customers.map(c => (
        <DealItem key={c.id} deal={c} lists={lists} />
      ))}
      {customers.length === 0 && (
        <p className='text-xs text-center text-slate-400'>No deals yet</p>
      )}
    </CardContent>
  )
}
