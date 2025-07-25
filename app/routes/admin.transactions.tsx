import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
} from 'react-router'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import { Input } from '~/components/ui/input'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface Transaction {
  id: number
  sale_date: string
  customer_name: string
  seller_name: string
  bundle: string
  bundle_with_cut: string
  stone_name: string
  sf?: number
  all_cut?: number
  any_cut?: number
  total_slabs?: number
  cut_slabs?: number
  cancelled_date: string | null
  installed_date: string | null
  sink_type?: string
  status?: string
}

function formatDate(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const companyId = user.company_id

    interface SinkInfo {
      sale_id: number
      sink_types: string
    }

    const sinkDetails = await selectMany<SinkInfo>(
      db,
      `SELECT 
         s.id as sale_id,
         GROUP_CONCAT(st.name) as sink_types
       FROM 
         sales s
       JOIN 
         slab_inventory si ON s.id = si.sale_id
       JOIN 
         sinks sk ON si.id = sk.slab_id
       JOIN 
         sink_type st ON sk.sink_type_id = st.id
       WHERE
         s.company_id = ?
       GROUP BY 
         s.id
       ORDER BY 
         s.id`,
      [companyId],
    )

    const transactions = await selectMany<Transaction>(
      db,
      `SELECT 
        s.id,
        s.sale_date,
        c.name as customer_name,
        u.name as seller_name,
        GROUP_CONCAT(DISTINCT si.bundle) as bundle,
        s.cancelled_date,
        s.installed_date,
        GROUP_CONCAT(DISTINCT st.name) as stone_name,
        s.square_feet as sf,
        GROUP_CONCAT(DISTINCT CONCAT(si.bundle, ':', IF(si.cut_date IS NOT NULL, 'CUT', 'UNCUT'))) as bundle_with_cut,
        MIN(CASE WHEN si.cut_date IS NULL THEN 0 ELSE 1 END) as all_cut,
        MAX(CASE WHEN si.cut_date IS NOT NULL THEN 1 ELSE 0 END) as any_cut,
        COUNT(si.id) as total_slabs,
        SUM(CASE WHEN si.cut_date IS NOT NULL THEN 1 ELSE 0 END) as cut_slabs
      FROM 
        sales s
      JOIN 
        customers c ON s.customer_id = c.id
      JOIN 
        users u ON s.seller_id = u.id
      LEFT JOIN
        slab_inventory si ON s.id = si.sale_id
      LEFT JOIN
        stones st ON si.stone_id = st.id
      WHERE
        s.company_id = ?
      GROUP BY
        s.id, s.sale_date, c.name, u.name
      ORDER BY 
        s.sale_date DESC`,
      [companyId],
    )

    const updatedTransactions = transactions.map(t => {
      const sinkInfo = sinkDetails.find(sd => sd.sale_id === t.id)
      let status = 'Sold' // Default status is Sold if there's a sale_date

      if (t.cancelled_date) {
        status = 'Cancelled'
      } else if (t.installed_date) {
        status = 'Installed'
      } else if (t.all_cut === 1) {
        status = 'Cut'
      } else if (t.any_cut === 1) {
        status = 'Partially Cut'
      }

      return {
        ...t,
        sink_type: sinkInfo ? sinkInfo.sink_types : undefined,
        status: status,
      }
    })

    return {
      transactions: updatedTransactions,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

const transactionColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: 'sale_date',
    header: ({ column }) => <SortableHeader column={column} title='Date' />,
    cell: ({ row }) => formatDate(row.original.sale_date),
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'customer_name',
    header: ({ column }) => <SortableHeader column={column} title='Customer' />,
    cell: ({ row }) => {
      const location = useLocation()
      return (
        <Link
          to={`edit/${row.original.id}${location.search}`}
          className='text-blue-600 hover:underline'
        >
          {row.original.customer_name}
        </Link>
      )
    },
  },
  {
    accessorKey: 'seller_name',
    header: ({ column }) => <SortableHeader column={column} title='Sold By' />,
  },
  {
    accessorKey: 'stone_name',
    header: ({ column }) => <SortableHeader column={column} title='Stone' />,
    cell: ({ row }) => {
      const stones = (row.original.stone_name || '').split(', ').filter(Boolean)
      if (!stones.length) return <span>N/A</span>

      const stoneCounts: { [key: string]: number } = {}
      stones.forEach(stone => {
        stoneCounts[stone] = (stoneCounts[stone] || 0) + 1
      })

      const formattedStones = Object.entries(stoneCounts).map(([stone, count]) =>
        count > 1 ? `${stone} x ${count}` : stone,
      )

      return (
        <div className='flex flex-col'>
          {formattedStones.map((stone, index) => (
            <span key={index}>{stone}</span>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: 'sink_type',
    header: ({ column }) => <SortableHeader column={column} title='Sink' />,
    cell: ({ row }) => {
      const sinks = (row.original.sink_type || '').split(', ').filter(Boolean)
      if (!sinks.length) return <span>N/A</span>

      const sinkCounts: { [key: string]: number } = {}
      sinks.forEach(sink => {
        sinkCounts[sink] = (sinkCounts[sink] || 0) + 1
      })

      const formattedSinks = Object.entries(sinkCounts).map(([sink, count]) =>
        count > 1 ? `${sink} x ${count}` : sink,
      )

      return (
        <div className='flex flex-col'>
          {formattedSinks.map((sink, index) => (
            <span key={index}>{sink}</span>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: 'sf',
    header: ({ column }) => <SortableHeader column={column} title='Sqft' />,
    cell: ({ row }) => {
      return row.original.sf ? <span>{row.original.sf}</span> : <span>N/A</span>
    },
  },
  {
    accessorKey: 'bundle',
    header: ({ column }) => <SortableHeader column={column} title='Bundle' />,
    cell: ({ row }) => {
      const bundleInfo = (row.original.bundle_with_cut || '').split(',').filter(Boolean)
      if (!bundleInfo.length) return <span>N/A</span>

      const bundleStatusMap: { [key: string]: boolean } = {}
      bundleInfo.forEach(item => {
        const [bundle, status] = item.split(':')
        bundleStatusMap[bundle] = status === 'CUT'
      })

      const bundles = (row.original.bundle || '').split(',').filter(Boolean)

      return (
        <div className='flex flex-col'>
          {bundles.map((bundle, index) => {
            const isCut = bundleStatusMap[bundle] === true
            return (
              <span key={index} className={isCut ? 'text-blue-500' : 'text-green-500'}>
                {bundle}
              </span>
            )
          })}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <SortableHeader column={column} title='Status' />,
    cell: ({ row }) => {
      let colorClass = 'text-green-500' // Default color for Sold
      if (row.original.cancelled_date) {
        colorClass = 'text-red-500'
      } else if (row.original.installed_date) {
        colorClass = 'text-purple-500'
      } else if (row.original.all_cut === 1) {
        colorClass = 'text-blue-500'
      } else if (row.original.any_cut === 1) {
        colorClass = 'text-gray-500'
      }

      return <span className={colorClass}>{row.original.status}</span>
    },
  },
  {
    id: 'actions',
    meta: {
      className: 'w-[50px]',
    },
    cell: ({ row }) => {
      const location = useLocation()
      return (
        <ActionDropdown
          actions={{
            edit: `edit/${row.original.id}${location.search}`,
            delete: `delete/${row.original.id}${location.search}`,
          }}
        />
      )
    },
  },
]

export default function AdminTransactions() {
  const { transactions } = useLoaderData<typeof loader>()
  const [searchTerm, setSearchTerm] = useState('')
  const location = useLocation()

  const filteredTransactions = transactions.filter(transaction =>
    transaction.customer_name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getPDF = async () => {
    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: {
          Accept: 'application/pdf',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`)
      }

      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url

      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/["']/g, '')
        : 'transaction-report.pdf'

      link.download = filename

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Error downloading PDF. Please try again.')
    }
  }

  return (
    <>
      <PageLayout title='Sales Transactions'>
        <div className='mb-4 flex justify-between items-center'>
          <div className='flex items-center gap-4'>
            <Link to='/admin/reports'>
              <Button variant='default' className='bg-blue-600 hover:bg-blue-700'>
                Reports
              </Button>
            </Link>
          </div>
          <div className='relative'>
            <Search className='absolute left-2 top-2.5 h-4 w-4 text-gray-500' />
            <Input
              placeholder='Search by customer'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='pl-8 w-64'
            />
          </div>
        </div>
        <DataTable columns={transactionColumns} data={filteredTransactions} />
      </PageLayout>
      <Outlet />
    </>
  )
}
