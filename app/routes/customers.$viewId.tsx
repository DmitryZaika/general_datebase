import {
  type LoaderFunctionArgs,
  useLoaderData,
  useSearchParams,
  redirect,
  useParams,
} from 'react-router'
import { z } from 'zod'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { db } from '~/db.server'
import { DataTable } from '~/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { Button } from '~/components/ui/button'
import { useFetcher } from 'react-router'
import { useEffect } from 'react'
import { getSession, commitSession } from '~/sessions'
import { toastData } from '~/utils/toastHelpers'
import { getStripe } from '~/utils/getStripe'

const paramsSchema = z.object({
  viewId: z.string().uuid('View ID must be a valid UUID'),
})

interface Sale {
  id: number
  sale_date: string
  price: number
  seller_name: string
  customer_name: string
  paid_date: string | null
  total_paid: number
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { viewId } = paramsSchema.parse(params)
  const url = new URL(request.url)
  const paymentStatus = url.searchParams.get('payment_status')
  const sessionId = url.searchParams.get('session_id')

  const sales = await selectMany<Sale>(
    db,
    `SELECT 
            s.id,
            s.sale_date,
            s.price,
            s.paid_date,
            u.name as seller_name,
            c.name as customer_name,
            COALESCE(SUM(sp.amount_total), 0) / 100 as total_paid
        FROM sales s
        JOIN users u ON s.seller_id = u.id
        JOIN customers c ON s.customer_id = c.id
        LEFT JOIN stripe_payments sp ON s.id = sp.sale_id
        WHERE c.view_id = UUID_TO_BIN(?)
        GROUP BY s.id, s.sale_date, s.price, s.paid_date, u.name, c.name
        ORDER BY s.sale_date DESC`,
    [viewId],
  )

  // Handle payment status
  if (paymentStatus === 'success' && sessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId)

      if (session.payment_status === 'paid' && session.metadata?.saleId) {
        const flashSession = await getSession(request.headers.get('Cookie'))
        flashSession.flash(
          'message',
          toastData('Success', 'Payment successful!', 'success'),
        )

        return redirect(`/customers/${viewId}`, {
          headers: { 'Set-Cookie': await commitSession(flashSession) },
        })
      }
    } catch (error) {
      console.error('Error processing payment success:', error)
    }
  } else if (paymentStatus === 'cancelled') {
    const flashSession = await getSession(request.headers.get('Cookie'))
    flashSession.flash(
      'message',
      toastData('Error', 'Payment was cancelled', 'destructive'),
    )

    return redirect(`/customers/${viewId}`, {
      headers: { 'Set-Cookie': await commitSession(flashSession) },
    })
  }

  return { customer: { name: sales[0].customer_name }, sales }
}

const columns: ColumnDef<Sale>[] = [
  {
    accessorKey: 'sale_date',
    header: ({ column }) => <SortableHeader column={column} title='Date' />,
    cell: ({ row }) => {
      const date = new Date(row.original.sale_date)
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date)
    },
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'price',
    header: ({ column }) => <SortableHeader column={column} title='Total Amount' />,
    cell: ({ row }) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(row.original.price)
    },
  },
  {
    id: 'total_paid',
    header: ({ column }) => <SortableHeader column={column} title='Amount Paid' />,
    cell: ({ row }) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(row.original.total_paid)
    },
  },
  {
    id: 'remaining',
    header: ({ column }) => <SortableHeader column={column} title='Amount Remaining' />,
    cell: ({ row }) => {
      const remaining = row.original.price - row.original.total_paid
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(remaining)
    },
  },
  {
    accessorKey: 'seller_name',
    header: ({ column }) => <SortableHeader column={column} title='Sold By' />,
  },
  {
    id: 'payment',
    header: 'Payment',
    cell: ({ row }) => {
      const fetcher = useFetcher()
      const params = useParams()
      const isPaid = row.original.total_paid >= row.original.price
      const isSubmitting = fetcher.state === 'submitting'
      const remaining = row.original.price - row.original.total_paid

      if (isPaid) {
        return <span className='text-green-600 font-medium'>Paid in full</span>
      }

      return (
        <fetcher.Form method='post' action='/api/stripe/create-checkout'>
          <input type='hidden' name='saleId' value={row.original.id} />
          <input type='hidden' name='amount' value={remaining} />
          <input type='hidden' name='viewId' value={params.viewId} />
          <Button
            type='submit'
            disabled={isSubmitting}
            className='bg-blue-600 hover:bg-blue-700'
          >
            {isSubmitting ? 'Processing...' : 'Pay Remaining'}
          </Button>
        </fetcher.Form>
      )
    },
  },
]

export default function CustomersView() {
  const { customer, sales } = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const paymentStatus = searchParams.get('payment_status')
  const params = useParams()

  useEffect(() => {
    // Clear the URL parameters after processing
    if (paymentStatus) {
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('payment_status')
      newUrl.searchParams.delete('session_id')
      window.history.replaceState({}, '', newUrl)
    }
  }, [paymentStatus])

  return (
    <div className='space-y-4'>
      <h1 className='text-2xl font-bold'>{customer?.name}</h1>
      <DataTable columns={columns} data={sales} />
    </div>
  )
}
