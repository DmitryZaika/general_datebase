import type { ColumnDef } from '@tanstack/react-table'
import { useEffect } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
}

interface SaleRow {
  id: number
  sale_date: string
  price: number
  seller_name: string
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    const customerId = Number(params.customerId)
    if (!customerId) return redirect('/admin/customers')

    const [customer] = await selectMany<Customer>(
      db,
      `SELECT id, name, phone, email, address
       FROM customers
       WHERE id = ? AND company_id = ?
       LIMIT 1`,
      [customerId, user.company_id],
    )

    const sales = await selectMany<SaleRow>(
      db,
      `SELECT s.id, s.sale_date, s.price, u.name as seller_name
       FROM sales s
       JOIN users u ON s.seller_id = u.id
       WHERE s.customer_id = ? AND s.company_id = ?
       ORDER BY s.sale_date DESC`,
      [customerId, user.company_id],
    )

    return { customer, sales }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function EmployeeCustomerView() {
  const { customer, sales } = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const paymentStatus = searchParams.get('payment_status')
  const navigate = useNavigate()

  useEffect(() => {
    if (paymentStatus) {
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('payment_status')
      newUrl.searchParams.delete('session_id')
      window.history.replaceState({}, '', newUrl)
    }
  }, [paymentStatus])

  const columns: ColumnDef<SaleRow>[] = [
    {
      accessorKey: 'sale_date',
      header: 'Date',
      cell: ({ row }) => {
        const d = new Date(row.original.sale_date)
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        const yyyy = d.getFullYear()
        return <span className='text-xs'>{`${mm}/${dd}/${yyyy}`}</span>
      },
    },
    { accessorKey: 'seller_name', header: 'Seller' },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) => `$${row.original.price}`,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant='outline'
          onClick={() => {
            window.open(`/api/pdf/${row.original.id}?type=sale`, '_blank')
          }}
        >
          Open PDF
        </Button>
      ),
    },
  ]

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  const clickableRows = sales.map(s => ({
    ...s,
  }))

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[80vw] w-[80vw] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Customer: {customer?.name}</DialogTitle>
        </DialogHeader>
        <div className='space-y-2'>
          <div className='text-sm text-gray-600'>
            {customer?.email || '—'} {customer?.phone ? `• ${customer.phone}` : ''}
          </div>
          <div className='text-sm text-gray-600'>{customer?.address || '—'}</div>
        </div>
        <div className='mt-4'>
          <DataTable columns={columns} data={clickableRows} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
