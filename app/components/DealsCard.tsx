import { Pencil } from 'lucide-react'
import { Link } from 'react-router'
import { CardContent } from '@/components/ui/card'

// import { db } from '~/db.server'
// import { csrf } from '~/utils/csrf.server'
// import { selectMany } from '~/utils/queryHelpers'
// import { getUserBySessionId } from '~/utils/session.server'
// import { ToastMessage } from '~/utils/toastHelpers'

interface IProps {
  title: string
  customers: ExtendedCustomer[]

  description?: string
}

interface ExtendedCustomer {
  id: number
  name: string
  amount: number
}

export default function DealsCard({ customers, description }: IProps) {
  return (
    <CardContent className='p-4 flex-col overflow-y-auto space-y-2'>
      {customers.map(customer => (
        <Link
          to={`edit/${customer.id}`}
          key={customer.id}
          className='bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-all flex justify-between items-center group'
        >
          <div>
            <div className='flex items-center justify-between gap-2'>
              <h3 className='text-xl font-medium truncate'>{customer.name}</h3>
              <Pencil className='w-4 h-4' />
            </div>
            <div className='flex items-center gap-2'>
              <p className='text-sm font-medium'>Amount: </p>
              <p className='text-sm font-medium'>
                $ {customer.amount.toLocaleString()}
              </p>
            </div>
            <div className='flex items-center gap-2 '>
              {description && (
                <p className='text-sm text-slate-500 cursor-pointer'>{description}</p>
              )}
            </div>
          </div>
        </Link>
      ))}
      {customers.length === 0 && (
        <p className='text-xs text-center text-slate-400'>No deals yet</p>
      )}
    </CardContent>
  )
}
