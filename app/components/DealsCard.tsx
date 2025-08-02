import { Pencil } from 'lucide-react'
import { Link } from 'react-router'
import { CardContent } from '@/components/ui/card'

// import { db } from '~/db.server'
// import { csrf } from '~/utils/csrf.server'
// import { selectMany } from '~/utils/queryHelpers'
// import { getUserBySessionId } from '~/utils/session.server'
// import { ToastMessage } from '~/utils/toastHelpers'

interface IProps {
  customers: ExtendedCustomer[]
}

interface ExtendedCustomer {
  id: number
  name: string
  amount?: number
  description?: string
  list_id?: number
  position?: number
  customer_id?: number
  status?: string
}

export default function DealsCard({ customers }: IProps) {
  return (
    <CardContent className='p-4 flex-col overflow-y-auto space-y-2 w-full'>
      {customers.map(customer => (
        <Link
          to={`edit/${customer.id}`}
          key={customer.id}
          className='bg-white w-full border rounded-lg p-3 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-3'
        >
          <div className='flex-1'>
            <h3 className='text-xl font-medium truncate'>{customer.name}</h3>
            <div className='flex items-center gap-2'>
              <p className='text-sm font-medium'>Amount:</p>
              <p className='text-sm font-medium'>
                $ {customer.amount?.toLocaleString()}
              </p>
            </div>
            {customer.description && (
              <p className='text-sm text-slate-500 mt-1 break-words'>
                {customer.description}
              </p>
            )}
          </div>

          <Pencil className='w-4 h-4 flex-shrink-0 text-gray-500 group-hover:text-black' />
        </Link>
      ))}
      {customers.length === 0 && (
        <p className='text-xs text-center text-slate-400'>No deals yet</p>
      )}
    </CardContent>
  )
}
