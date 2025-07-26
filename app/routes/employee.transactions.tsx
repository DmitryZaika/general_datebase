import type { ColumnDef } from '@tanstack/react-table'
import { Calendar, MoreHorizontal, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type ActionFunctionArgs,
  Form,
  Link,
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
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

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
    const user = await getEmployeeUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const companyId = user.company_id
    const url = new URL(request.url)

    const searchTerm = url.searchParams.get('search') || ''
    const salesRep = url.searchParams.get('salesRep') || user.name
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

    if (searchTerm) {
      query += ` AND (
        c.name LIKE ? OR
        u.name LIKE ? OR
        si.bundle LIKE ? OR
        st.name LIKE ?
      )`
      const searchPattern = `%${searchTerm}%`
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
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
        search: searchTerm,
        salesRep,
        status,
      },
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request)
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
  const [searchValue, setSearchValue] = useState(filters.search)
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([])
  const [showCustomers, setShowCustomers] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [installDialogOpen, setInstallDialogOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(
    null,
  )
  const [installDate, setInstallDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )
  const [isPaid, setIsPaid] = useState(true)

  // Fetch customers when search value changes
  useEffect(() => {
    // Only search when there's at least 2 characters to avoid excessive API calls
    if (searchValue.length >= 2) {
      const fetchCustomers = async () => {
        try {
          const response = await fetch(
            `/api/customers/search?term=${encodeURIComponent(searchValue)}`,
          )
          if (response.ok) {
            const data = await response.json()
            setCustomers(data.customers || [])
            setShowCustomers(data.customers && data.customers.length > 0)
          } else {
            setCustomers([])
            setShowCustomers(false)
          }
        } catch {
          setCustomers([])
          setShowCustomers(false)
        }
      }

      fetchCustomers()
    } else {
      setCustomers([])
      setShowCustomers(false)
    }
  }, [searchValue])

  const handleSalesRepChange = (value: string) => {
    searchParams.set('salesRep', value)
    setSearchParams(searchParams)
  }

  const handleStatusChange = (value: string) => {
    searchParams.set('status', value)
    setSearchParams(searchParams)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    searchParams.set('search', searchValue)
    setSearchParams(searchParams)
    setShowCustomers(false)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
  }

  const handleSelectCustomer = (customer: { id: number; name: string }) => {
    setSearchValue(customer.name)
    searchParams.set('search', customer.name)
    setSearchParams(searchParams)
    setShowCustomers(false)
  }

  const handleRowClick = (id: number) => {
    navigate(`edit/${id}${location.search}`)
  }

  const openInstallDialog = (id: number) => {
    setSelectedTransactionId(id)
    setInstallDate(new Date().toISOString().slice(0, 10)) // Reset to today
    setIsPaid(true) // Reset paid to default true
    setInstallDialogOpen(true)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    // Закрываем диалог перед отправкой формы
    setInstallDialogOpen(false)
    // Не прерываем стандартную отправку формы
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
        const stonesArr = (row.original.stone_name || '').split(/,\s*/).filter(Boolean)
        if (!stonesArr.length) return <span>N/A</span>

        return (
          <div className='flex flex-col'>
            {stonesArr.map((s, idx) => (
              <span key={idx}>{s}</span>
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
                <span
                  key={index}
                  className={isCut ? 'text-blue-500' : 'text-green-500'}
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
    {
      id: 'actions',
      cell: ({ row }) => {
        const isInstalled = row.original.installed_date !== null
        const isCancelled = row.original.cancelled_date !== null
        const allCut = row.original.all_cut === 1

        const canInstall = allCut && !isInstalled && !isCancelled

        return (
          <div
            className='flex items-center justify-center'
            onClick={e => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='h-8 w-8 p-0'>
                  <span className='sr-only'>Open menu</span>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    openInstallDialog(row.original.id)
                  }}
                  disabled={!canInstall}
                  className={!canInstall ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Mark as Installed
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/pdf/${row.original.id}`}>Contract</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  const formAction = `/employee/transactions${location.search}`

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
          <div className='relative'>
            <form onSubmit={handleSearchSubmit} className='flex items-center gap-2'>
              <div className='relative'>
                <Search className='absolute left-2 top-2.5 h-4 w-4 text-gray-500' />
                <Input
                  placeholder='Search transactions...'
                  value={searchValue}
                  onChange={handleSearchChange}
                  className='pl-8 w-64'
                />
                {showCustomers && customers.length > 0 && (
                  <div className='absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg'>
                    <ul className='py-1 divide-y divide-gray-200'>
                      {customers.map(customer => (
                        <li
                          key={customer.id}
                          className='px-4 py-2 hover:bg-gray-50 cursor-pointer'
                          onClick={() => handleSelectCustomer(customer)}
                        >
                          {customer.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Button type='submit' variant='outline' size='sm'>
                Search
              </Button>
            </form>
          </div>
        </div>
        <DataTable
          columns={transactionColumns}
          data={transactions.map(transaction => ({
            ...transaction,
            className: 'hover:bg-gray-50 cursor-pointer',
            onClick: () => handleRowClick(transaction.id),
          }))}
        />
      </PageLayout>

      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Transaction as Installed</DialogTitle>
          </DialogHeader>

          <Form method='post' action={formAction} onSubmit={handleFormSubmit}>
            <input type='hidden' name='intent' value='mark-installed' />
            <input
              type='hidden'
              name='transactionId'
              value={selectedTransactionId?.toString() || ''}
            />

            <div className='py-4 space-y-4'>
              <div className='flex items-center gap-4'>
                <Label htmlFor='installation-date' className='text-right w-[140px]'>
                  Installation Date
                </Label>
                <div className='relative '>
                  <Calendar className='absolute left-3 top-2.5 h-4 w-4 text-gray-500' />
                  <Input
                    id='installation-date'
                    name='installedDate'
                    type='date'
                    value={installDate}
                    onChange={e => setInstallDate(e.target.value)}
                    className='pl-10'
                  />
                </div>
              </div>

              <div className='flex items-center gap-4'>
                <Label htmlFor='paid-switch' className='text-right w-[140px]'>
                  Paid
                </Label>
                <div className='flex items-center gap-2'>
                  <input
                    type='hidden'
                    name='isPaid'
                    value={isPaid ? 'true' : 'false'}
                  />
                  <Switch
                    id='paid-switch'
                    checked={isPaid}
                    onCheckedChange={setIsPaid}
                  />
                  <span className='text-sm text-gray-500'>
                    {isPaid ? 'Mark as paid on same date' : 'Do not mark as paid'}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setInstallDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit'>Confirm</Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      <Outlet />
    </>
  )
}
