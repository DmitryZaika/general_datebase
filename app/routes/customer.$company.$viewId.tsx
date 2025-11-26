import { ColumnDef } from '@tanstack/react-table'
import { useEffect, useState } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useSearchParams
} from 'react-router'
import { z } from 'zod'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { DataTable } from '~/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { getStripe } from '~/utils/getStripe'
import { selectMany } from '~/utils/queryHelpers'
import { toastData } from '~/utils/toastHelpers.server'

const paramsSchema = z.object({
  viewId: z.string().uuid('View ID must be a valid UUID'),
})

function writeStorageIfBlank(key: 'customerViewId', value: string) {
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, value)
  }
}

interface Sale {
  id: number
  sale_date: string
  price: number
  seller_name: string | null
  customer_name: string
  stone_name: string | null
  stone_pictures: string | null
  sink: string | null
  sink_pictures: string | null
  status: string
  company_id: number
  all_cut?: number | null
  any_cut?: number | null
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
        u.name AS seller_name,
        c.name AS customer_name,
        MAX(st.name) AS stone_name,
        GROUP_CONCAT(DISTINCT st.url ORDER BY si.id SEPARATOR ',') AS stone_pictures,
        MAX(sty.name) AS sink,
        GROUP_CONCAT(DISTINCT isk.url ORDER BY isk.id SEPARATOR ',') AS sink_pictures,
        MIN(CASE WHEN si.cut_date IS NULL THEN 0 ELSE 1 END) AS all_cut,
        MAX(CASE WHEN si.cut_date IS NOT NULL THEN 1 ELSE 0 END) AS any_cut,
        CASE
          WHEN s.cancelled_date IS NOT NULL THEN 'Cancelled'
          WHEN s.installed_date IS NOT NULL THEN 'Installed'
          WHEN s.sale_date IS NOT NULL AND s.cancelled_date IS NULL AND s.installed_date IS NULL THEN 'Sold'
        END AS status
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.seller_id = u.id
      LEFT JOIN slab_inventory si ON si.sale_id = s.id
      LEFT JOIN stones st ON st.id = si.stone_id
      LEFT JOIN sinks sk ON sk.slab_id = si.id AND sk.is_deleted = 0
      LEFT JOIN sink_type sty ON sty.id = sk.sink_type_id
      LEFT JOIN installed_sinks isk ON isk.sink_id = sk.id
      WHERE c.view_id = UUID_TO_BIN(?)
      GROUP BY s.id, s.sale_date, s.price, u.name, c.name, c.company_id
      ORDER BY s.sale_date DESC`,
    [viewId],
  )

  const enrichedSales = sales.map(sale => {
    let currentStatus = sale.status
    if (currentStatus === 'Sold' || currentStatus === 'Paid') {
      if (sale.all_cut === 1) {
        currentStatus = 'Cut'
      } else if (sale.any_cut === 1) {
        currentStatus = 'Partially Cut'
      }
    }
    return {
      ...sale,
      status: currentStatus,
    }
  })

  const customerRows = await selectMany<{ name: string }>(
    db,
    `SELECT name FROM customers WHERE view_id = UUID_TO_BIN(?) LIMIT 1`,
    [viewId],
  )

  const customerName = (sales[0] && sales[0].customer_name) || (customerRows[0] && customerRows[0].name) || ''

  // Handle payment status
  if (paymentStatus === 'success' && sessionId) {
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

  const customer = customerName ? { name: customerName } : null

  return { customer, sales: enrichedSales, viewId }
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
    accessorKey: 'stone_name',
    header: ({ column }) => <SortableHeader column={column} title='Stone' />,
    cell: ({ row }) => row.original.stone_name || '—',
  },
  {
    id: 'stone_pictures',
    header: ({ column }) => <SortableHeader column={column} title='Stone Pictures' />,
    cell: ({ row }) => {
      return (
        <ImageGalleryCell
          images={row.original.stone_pictures}
          title={row.original.stone_name || 'Stone'}
        />
      )
    },
  },
  {
    accessorKey: 'sink',
    header: ({ column }) => <SortableHeader column={column} title='Sink' />,
    cell: ({ row }) => row.original.sink || '—',
  },
  // {
  //   accessorKey: 'sink_pictures',
  //   header: ({ column }) => <SortableHeader column={column} title='Sink Pictures' />,
  //   cell: ({ row }) => {
  //     return (
  //       <ImageGalleryCell
  //         images={row.original.sink_pictures}
  //         title={row.original.sink || 'Sink'}
  //       />
  //     )
  //   },
  // },
  {
    accessorKey: 'seller_name',
    header: ({ column }) => <SortableHeader column={column} title='Sales Rep' />,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <SortableHeader column={column} title='Status' />,
    cell: ({ row }) => row.original.status || '—',
  }
 
]

function ImageGalleryCell({ images, title }: { images: string | null; title: string }) {
  const list = (images || '')
    .split(',')
    .map(url => url.trim())
    .filter(Boolean)
    .map(url => (url && url !== 'undefined' ? url : '/placeholder.png'))
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (list.length === 0) return <span className='text-xs text-slate-500'>No photos</span>

  const handleOpen = (index: number) => {
    setCurrentIndex(index)
    setIsOpen(true)
  }

  return (
    <>
      <div className='flex items-center gap-2 max-w-xs overflow-x-auto'>
        {list.slice(0, 3).map((url, index) => (
          <button
            key={`${url}-${index}`}
            type='button'
            className='h-12 w-16 overflow-hidden rounded border'
            onClick={() => handleOpen(index)}
          >
            <img src={url} alt={title} className='h-full w-full object-cover cursor-pointer' loading='lazy' />
          </button>
        ))}
        {list.length > 3 && <span className='text-xs text-slate-500'>+{list.length - 3}</span>}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className='max-w-4xl bg-zinc-900 text-white'>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className='flex flex-col gap-4'>
            <img
              src={list[currentIndex]}
              alt={title}
              className='max-h-[70vh] w-full object-contain rounded'
            />
            <div className='flex items-center justify-between text-xs text-zinc-300'>
              <span>
                {currentIndex + 1}/{list.length}
              </span>
              <a href={list[currentIndex]} target='_blank' rel='noreferrer' className='underline'>
                Open image
              </a>
            </div>
            {list.length > 1 && (
              <div className='flex gap-2 overflow-x-auto'>
                {list.map((url, index) => (
                  <button
                    key={`${url}-${index}-thumb`}
                    type='button'
                    onClick={() => setCurrentIndex(index)}
                    className={`h-16 w-20 overflow-hidden rounded border ${index === currentIndex ? 'border-white' : 'border-transparent'}`}
                  >
                    <img src={url} alt={`${title} ${index + 1}`} className='h-full w-full object-cover' />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function CustomersView() {
  const { customer, sales, viewId } = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const paymentStatus = searchParams.get('payment_status')

  useEffect(() => {
    writeStorageIfBlank('customerViewId', viewId)
  }, [viewId])

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
      <h1 className='text-2xl font-bold pl-2'>{customer?.name}</h1>
      
      <DataTable columns={columns} data={sales} />
    </div>
  )
}
