import type { ColumnDef } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
    Outlet,
    redirect,
    useLoaderData,
    useLocation,
    useNavigate,
    useSearchParams,
} from 'react-router'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { PageLayout } from '~/components/PageLayout'
import { DataTable } from '~/components/ui/data-table'
import { Input } from '~/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '~/components/ui/select'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { selectMany } from '~/utils/queryHelpers'
import { getShopWorkerUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

interface Transaction {
  id: number
  sale_date: string
  customer_name: string
  seller_name: string
  bundle: string
  bundle_with_cut: string
  stone_name: string
  project_address?: string | null
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

interface SlabInfo {
  id: number
  cut_date: string | null
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
    const user = await getShopWorkerUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const companyId = user.company_id
    const url = new URL(request.url)

    const salesRep = url.searchParams.get('salesRep') || 'All'
    const status = url.searchParams.get('status') || 'in_progress'

    let query = `
      SELECT
        s.id,
        s.sale_date,
        c.name as customer_name,
        u.name as seller_name,
        GROUP_CONCAT(DISTINCT si.bundle) as bundle,
        s.cancelled_date,
        s.installed_date,
        GROUP_CONCAT(DISTINCT CONCAT(st.name, ':', IF(si.deleted_at IS NOT NULL, 'DELETED', 'ACTIVE'))) as stone_name,
        (
          SELECT SUM(room_sqft)
          FROM (
            SELECT
              MAX(si2.square_feet) as room_sqft
            FROM slab_inventory si2
            WHERE si2.sale_id = s.id
            GROUP BY
              CASE
                WHEN si2.room_uuid IS NOT NULL THEN CONCAT('uuid:', HEX(si2.room_uuid))
                WHEN COALESCE(NULLIF(TRIM(si2.room), ''), '') <> '' THEN CONCAT(
                  'room:',
                  LOWER(TRIM(si2.room)),
                  ':bundle:',
                  COALESCE(si2.bundle, ''),
                  ':slab:',
                  si2.id
                )
                ELSE CONCAT('bundle:', COALESCE(si2.bundle, ''), ':slab:', si2.id)
              END
          ) room_totals
        ) as sf,
        s.project_address,
        GROUP_CONCAT(DISTINCT CONCAT(si.bundle, ':', IF(si.cut_date IS NOT NULL, 'CUT', 'UNCUT'), ':', IF(si.deleted_at IS NOT NULL, 'DELETED', 'ACTIVE'))) as bundle_with_cut,
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
    `

    const queryParams: (string | number)[] = [companyId]

    if (salesRep && salesRep !== 'All') {
      query += ' AND u.name = ?'
      queryParams.push(salesRep)
    }

    if (status === 'in_progress') {
      query += ' AND s.installed_date IS NULL AND s.cancelled_date IS NULL'
    } else if (status === 'finished') {
      query += ' AND (s.installed_date IS NOT NULL OR s.cancelled_date IS NOT NULL)'
    }

    query += `
      GROUP BY
        s.id, s.sale_date, c.name, u.name
      ORDER BY
        s.sale_date DESC
    `

    const transactions = await selectMany<Transaction>(db, query, queryParams)

    interface SinkInfo {
      sale_id: number
      sink_types: string
    }

    const sinkDetails = await selectMany<SinkInfo>(
      db,
      `SELECT
         sales.id as sale_id,
         GROUP_CONCAT(st.name SEPARATOR ', ') as sink_types
       FROM
         sales
       JOIN
         slab_inventory si ON sales.id = si.sale_id
       JOIN
         sinks sk ON si.id = sk.slab_id
       JOIN
         sink_type st ON sk.sink_type_id = st.id
       WHERE
         sales.company_id = ?
       GROUP BY
         sales.id
       ORDER BY
         sales.id`,
      [companyId],
    )

    const allSalesReps = await selectMany<{ name: string }>(
      db,
      `SELECT DISTINCT users.name
       FROM users
       JOIN sales ON users.id = sales.seller_id
       WHERE sales.company_id = ?`,
      [companyId],
    )

    const salesReps = ['All', ...allSalesReps.map(rep => rep.name)]

    const updatedTransactions = transactions.map(t => {
      const sinkInfo = sinkDetails.find(sd => sd.sale_id === t.id)
      let status = 'Sold'

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
      salesReps,
      filters: {
        salesRep,
        status,
      },
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getShopWorkerUser(request)
  if (!user || !user.company_id) {
    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Error', 'Unauthorized', 'destructive'))
    return redirect('/login', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  const formData = await request.formData()
  const intent = formData.get('intent')
  const transactionId = formData.get('transactionId') as string
  const installedDate = formData.get('installedDate') as string
  const isPaid = formData.get('isPaid') === 'true'

  // Сохраняем текущий URL для редиректа обратно
  const url = new URL(request.url)
  const redirectUrl =
    url.searchParams.get('redirectTo') || `/employee/transactions${url.search}`

  if (intent === 'mark-installed') {
    try {
      const transaction = await selectMany<{ installed_date: string | null }>(
        db,
        `SELECT installed_date FROM sales WHERE id = ?`,
        [transactionId],
      )

      if (transaction.length === 0) {
        const session = await getSession(request.headers.get('Cookie'))
        session.flash(
          'message',
          toastData('Error', 'Transaction not found', 'destructive'),
        )
        return redirect(redirectUrl, {
          headers: { 'Set-Cookie': await commitSession(session) },
        })
      }

      if (transaction[0].installed_date) {
        const session = await getSession(request.headers.get('Cookie'))
        session.flash(
          'message',
          toastData(
            'Error',
            'Transaction is already marked as installed',
            'destructive',
          ),
        )
        return redirect(redirectUrl, {
          headers: { 'Set-Cookie': await commitSession(session) },
        })
      }

      const slabs = await selectMany<SlabInfo>(
        db,
        `SELECT id, cut_date FROM slab_inventory WHERE sale_id = ?`,
        [transactionId],
      )

      if (slabs.length === 0) {
        const session = await getSession(request.headers.get('Cookie'))
        session.flash(
          'message',
          toastData('Error', 'No slabs found for this transaction', 'destructive'),
        )
        return redirect(redirectUrl, {
          headers: { 'Set-Cookie': await commitSession(session) },
        })
      }

      const allCut = slabs.every(slab => slab.cut_date !== null)

      if (!allCut) {
        const session = await getSession(request.headers.get('Cookie'))
        session.flash(
          'message',
          toastData(
            'Error',
            'Cannot mark as installed - not all slabs are cut',
            'destructive',
          ),
        )
        return redirect(redirectUrl, {
          headers: { 'Set-Cookie': await commitSession(session) },
        })
      }

      // Format the date for SQL or use current date if not provided
      const dateToUse = installedDate
        ? new Date(installedDate).toISOString().slice(0, 19).replace('T', ' ')
        : new Date().toISOString().slice(0, 19).replace('T', ' ')

      // If paid is true, update both installed_date and paid_date
      if (isPaid) {
        await db.execute(
          `UPDATE sales SET installed_date = ?, paid_date = ? WHERE id = ?`,
          [dateToUse, dateToUse, transactionId],
        )
      } else {
        await db.execute(`UPDATE sales SET installed_date = ? WHERE id = ?`, [
          dateToUse,
          transactionId,
        ])
      }

      const session = await getSession(request.headers.get('Cookie'))
      session.flash('message', toastData('Success', 'Transaction marked as installed'))

      return redirect(redirectUrl, {
        headers: { 'Set-Cookie': await commitSession(session) },
      })
    } catch {
      const session = await getSession(request.headers.get('Cookie'))
      session.flash(
        'message',
        toastData('Error', 'Failed to update status', 'destructive'),
      )

      return redirect(redirectUrl, {
        headers: { 'Set-Cookie': await commitSession(session) },
      })
    }
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Error', 'Invalid action', 'destructive'))
  return redirect(redirectUrl, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function EmployeeTransactions() {
  const { transactions, salesReps, filters } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const searchRef = useRef<HTMLDivElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [installDialogOpen, setInstallDialogOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(
    null,
  )
  const [installDate, setInstallDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )
  const [isPaid, setIsPaid] = useState(true)

  const handleSalesRepChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('salesRep', value)
    setSearchParams(next)
  }

  const handleStatusChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('status', value)
    setSearchParams(next)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsInputFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleRowClick = (id: number) => {
    navigate(`edit/${id}${location.search}`)
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
      cell: ({ row }) => (
        <span className='text-blue-600'>{row.original.customer_name}</span>
      ),
    },
    {
      accessorKey: 'seller_name',
      header: ({ column }) => <SortableHeader column={column} title='Sold By' />,
    },
    {
      accessorKey: 'stone_name',
      header: ({ column }) => <SortableHeader column={column} title='Stone' />,
      cell: ({ row }) => {
        const stonesArr = (row.original.stone_name || '').split(',').filter(Boolean)
        if (!stonesArr.length) return <span>N/A</span>

        const stoneCounts: { [key: string]: number } = {}

        stonesArr.forEach(item => {
          const [stone, status] = item.split(':')
          stoneCounts[stone] = (stoneCounts[stone] || 0) + 1
          // If any occurrence is active, consider active (or handle mixed status differently if needed)
          // Here we assume if ALL occurrences of a stone name are deleted, it's deleted.
          // But the query uses DISTINCT CONCAT(name, status).
          // So if we have "StoneA:ACTIVE" and "StoneA:DELETED", they are distinct items.

          // Let's just map the full items.
        })

        // Since we get "StoneA:ACTIVE" and "StoneA:DELETED" as distinct items
        // We should probably just display them.

        return (
          <div className='flex flex-col'>
            {stonesArr.map((item, idx) => {
              const [stone, status] = item.split(':')
              const isDeleted = status === 'DELETED'
              return (
                <span
                  key={idx}
                  className={isDeleted ? 'text-red-500 line-through' : ''}
                >
                  {stone}
                </span>
              )
            })}
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
      accessorKey: 'bundle',
      header: ({ column }) => <SortableHeader column={column} title='Bundle' />,
      cell: ({ row }) => {
        const bundleInfo = (row.original.bundle_with_cut || '')
          .split(',')
          .filter(Boolean)
        if (!bundleInfo.length) return <span>N/A</span>

        return (
          <div className='flex flex-col'>
            {bundleInfo.map((item, index) => {
              const [bundle, cutStatus, deletedStatus] = item.split(':')
              const isCut = cutStatus === 'CUT'
              const isDeleted = deletedStatus === 'DELETED'

              return (
                <span
                  key={index}
                  className={`
                    ${isDeleted ? 'text-red-500 line-through' : isCut ? 'text-blue-500' : 'text-green-500'}
                  `}
                >
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
        let colorClass = 'text-green-500'
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
  ]

  return (
    <>
      <PageLayout title='Sales Transactions'>
        <div className='flex justify-between items-center'>
          <div className='flex items-center gap-4'>
            <div className='flex gap-4 items-center'>
              <div className='w-1/8 min-w-[120px]'>
                <div className='mb-1 text-sm font-medium'>Sales Rep</div>
                <Select value={filters.salesRep} onValueChange={handleSalesRepChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Sales Rep' />
                  </SelectTrigger>
                  <SelectContent>
                    {salesReps.map(rep => (
                      <SelectItem key={rep} value={rep}>
                        {rep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='w-1/8 min-w-[120px]'>
                <div className='mb-1 text-sm font-medium'>Status</div>
                <Select value={filters.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Status' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='in_progress'>In Progress</SelectItem>
                    <SelectItem value='finished'>Finished</SelectItem>
                    <SelectItem value='all'>All Statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div ref={searchRef} className='relative w-80'>
            <div className='relative'>
              <Input
                type='text'
                placeholder='Search transactions...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                className='pr-10 py-2 rounded-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition'
              />
              <div className='absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500'>
                <Search />
              </div>
            </div>
            {isInputFocused && searchTerm && (
              <div className='absolute z-50 w-full mt-2 bg-white shadow-xl rounded-lg border border-gray-200 max-h-72 overflow-y-auto'>
                {transactions
                  .filter(tx => {
                    if ((tx.total_slabs ?? 0) === 0) return false
                    const term = searchTerm.toLowerCase()
                    return (
                      tx.customer_name.toLowerCase().includes(term) ||
                      tx.seller_name.toLowerCase().includes(term) ||
                      (tx.bundle || '').toLowerCase().includes(term) ||
                      (tx.stone_name || '').toLowerCase().includes(term)
                    )
                  })
                  .slice(0, 20)
                  .map(tx => (
                    <div
                      key={tx.id}
                      onClick={() => {
                        navigate(`edit/${tx.id}${location.search}`)
                        setIsInputFocused(false)
                        setSearchTerm('')
                      }}
                      className='p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none'
                    >
                      <div className='font-medium text-gray-800'>
                        {tx.customer_name}
                      </div>
                      <div className='text-xs text-gray-500 flex justify-between'>
                        <span>{formatDate(tx.sale_date)}</span>
                        <span>{tx.seller_name}</span>
                      </div>
                      <div className='text-xs text-gray-500 truncate'>
                        {tx.project_address || 'No address'}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        <DataTable
          columns={transactionColumns}
          data={transactions.map(transaction => ({
            ...transaction,
            className: 'hover:bg-gray-50 cursor-pointer',
          }))}
          onRowClick={row => handleRowClick(row.id)}
          paginate
          pageSize={50}
        />
      </PageLayout>
      <Outlet />
    </>
  )
}
