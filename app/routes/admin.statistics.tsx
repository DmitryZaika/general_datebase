import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import { DataTable } from '~/components/ui/data-table'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

type SalesBySeller = {
  seller_id: number
  seller_name: string
  sales_count: number
  total_revenue: number
  avg_ticket: number
}

type DealsByRep = {
  rep_id: number
  rep_name: string
  deals_count: number
  total_amount: number
  avg_amount: number
}

type DealsByStage = {
  list_name: string
  deals_count: number
  total_amount: number
}

type CustomersBySource = {
  source: string | null
  total: number
}

type CustomersByRep = {
  rep_name: string | null
  total: number
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) return redirect('/login')

    const url = new URL(request.url)
    const fromDate = url.searchParams.get('fromDate') || ''
    const toDate = url.searchParams.get('toDate') || ''

    const dateFilters: string[] = []
    const dateParams: (string | number)[] = []
    if (fromDate) {
      dateFilters.push('DATE(s.sale_date) >= ?')
      dateParams.push(fromDate)
    }
    if (toDate) {
      dateFilters.push('DATE(s.sale_date) <= ?')
      dateParams.push(toDate)
    }

    const salesWhere = [
      's.company_id = ?',
      's.cancelled_date IS NULL',
      's.sale_date IS NOT NULL',
      ...dateFilters,
    ]

    const salesBySeller = await selectMany<SalesBySeller>(
      db,
      `SELECT u.id AS seller_id, u.name AS seller_name, COUNT(s.id) AS sales_count,
              COALESCE(SUM(s.price), 0) AS total_revenue,
              COALESCE(AVG(s.price), 0) AS avg_ticket
       FROM sales s
       JOIN users u ON s.seller_id = u.id
       WHERE ${salesWhere.join(' AND ')}
       GROUP BY u.id, u.name
       ORDER BY total_revenue DESC`,
      [user.company_id, ...dateParams],
    )

    const dealsByRep = await selectMany<DealsByRep>(
      db,
      `SELECT u.id AS rep_id, u.name AS rep_name,
              COUNT(d.id) AS deals_count,
              COALESCE(SUM(d.amount), 0) AS total_amount,
              COALESCE(AVG(d.amount), 0) AS avg_amount
       FROM deals d
       JOIN users u ON d.user_id = u.id
       JOIN customers c ON d.customer_id = c.id
       WHERE c.company_id = ? AND d.deleted_at IS NULL
       GROUP BY u.id, u.name
       ORDER BY deals_count DESC`,
      [user.company_id],
    )

    const dealsByStage = await selectMany<DealsByStage>(
      db,
      `SELECT l.name AS list_name,
              COUNT(d.id) AS deals_count,
              COALESCE(SUM(d.amount), 0) AS total_amount
       FROM deals d
       JOIN deals_list l ON d.list_id = l.id
       JOIN customers c ON d.customer_id = c.id
       WHERE c.company_id = ? AND d.deleted_at IS NULL
       GROUP BY l.id, l.name
       ORDER BY l.position ASC`,
      [user.company_id],
    )

    const customersTotals = await selectMany<{
      total: number
      without_rep: number
      invalid: number
      last_30: number
    }>(
      db,
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN sales_rep IS NULL THEN 1 ELSE 0 END) AS without_rep,
         SUM(CASE WHEN invalid_lead IS NOT NULL AND invalid_lead <> '' THEN 1 ELSE 0 END) AS invalid,
         SUM(CASE WHEN created_date >= (CURRENT_DATE - INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS last_30
       FROM customers
       WHERE company_id = ?`,
      [user.company_id],
    )

    const customersBySource = await selectMany<CustomersBySource>(
      db,
      `SELECT source, COUNT(*) AS total
       FROM customers
       WHERE company_id = ?
       GROUP BY source
       ORDER BY total DESC`,
      [user.company_id],
    )

    const customersByRep = await selectMany<CustomersByRep>(
      db,
      `SELECT u.name AS rep_name, COUNT(c.id) AS total
       FROM customers c
       LEFT JOIN users u ON c.sales_rep = u.id
       WHERE c.company_id = ?
       GROUP BY u.name
       ORDER BY total DESC`,
      [user.company_id],
    )

    return {
      salesBySeller,
      dealsByRep,
      dealsByStage,
      customersTotals: customersTotals[0] || {
        total: 0,
        without_rep: 0,
        invalid: 0,
        last_30: 0,
      },
      customersBySource,
      customersByRep,
      fromDate,
      toDate,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function AdminStatistics() {
  const {
    salesBySeller,
    dealsByRep,
    dealsByStage,
    customersTotals,
    customersBySource,
    customersByRep,
    fromDate,
    toDate,
  } = useLoaderData<typeof loader>()

  const navigate = useNavigate()
  const [from, setFrom] = useState(fromDate || '')
  const [to, setTo] = useState(toDate || '')

  const currency = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    [],
  )

  const salesColumns: ColumnDef<SalesBySeller>[] = [
    { accessorKey: 'seller_name', header: 'Seller' },
    { accessorKey: 'sales_count', header: 'Sales' },
    {
      accessorKey: 'total_revenue',
      header: 'Total',
      cell: ({ row }) => currency.format(row.original.total_revenue || 0),
    },
    {
      accessorKey: 'avg_ticket',
      header: 'Average',
      cell: ({ row }) => currency.format(row.original.avg_ticket || 0),
    },
  ]

  const dealsRepColumns: ColumnDef<DealsByRep>[] = [
    { accessorKey: 'rep_name', header: 'Sales Rep' },
    { accessorKey: 'deals_count', header: 'Deals' },
    {
      accessorKey: 'total_amount',
      header: 'Total Amount',
      cell: ({ row }) => currency.format(row.original.total_amount || 0),
    },
    {
      accessorKey: 'avg_amount',
      header: 'Average Amount',
      cell: ({ row }) => currency.format(row.original.avg_amount || 0),
    },
  ]

  const dealsStageColumns: ColumnDef<DealsByStage>[] = [
    { accessorKey: 'list_name', header: 'Stage' },
    { accessorKey: 'deals_count', header: 'Deals' },
    {
      accessorKey: 'total_amount',
      header: 'Total Amount',
      cell: ({ row }) => currency.format(row.original.total_amount || 0),
    },
  ]

  const customersBySourceColumns: ColumnDef<CustomersBySource>[] = [
    { accessorKey: 'source', header: 'Source' },
    { accessorKey: 'total', header: 'Customers' },
  ]

  const customersByRepColumns: ColumnDef<CustomersByRep>[] = [
    { accessorKey: 'rep_name', header: 'Sales Rep' },
    { accessorKey: 'total', header: 'Customers' },
  ]

  const salesTotals = useMemo(() => {
    const totalRevenue = salesBySeller.reduce(
      (acc, s) => acc + (s.total_revenue || 0),
      0,
    )
    const totalCount = salesBySeller.reduce((acc, s) => acc + (s.sales_count || 0), 0)
    const avgTicket = totalCount > 0 ? totalRevenue / totalCount : 0
    return { totalRevenue, totalCount, avgTicket }
  }, [JSON.stringify(salesBySeller)])

  return (
    <PageLayout title='Statistics'>
      <div className='flex justify-between items-center mb-4'>
        <Tabs
          value='statistics'
          onValueChange={v =>
            navigate(v === 'statistics' ? '/admin/statistics' : '/admin/deals')
          }
        >
          <TabsList>
            <TabsTrigger value='board'>CRM</TabsTrigger>
            <TabsTrigger value='statistics'>Statistics</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className='flex items-center gap-2'>
          <form method='get' className='flex items-center gap-2'>
            <input
              type='date'
              name='fromDate'
              value={from}
              onChange={e => setFrom(e.target.value)}
              className='border rounded px-2 py-1'
            />
            <input
              type='date'
              name='toDate'
              value={to}
              onChange={e => setTo(e.target.value)}
              className='border rounded px-2 py-1'
            />
            <button
              type='submit'
              className='px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded'
            >
              Apply
            </button>
          </form>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
        <div className='border rounded p-4'>
          <div className='text-sm text-slate-500'>Total Sales</div>
          <div className='text-2xl font-semibold'>
            {currency.format(salesTotals.totalRevenue)}
          </div>
        </div>
        <div className='border rounded p-4'>
          <div className='text-sm text-slate-500'>Sales Count</div>
          <div className='text-2xl font-semibold'>{salesTotals.totalCount}</div>
        </div>
        <div className='border rounded p-4'>
          <div className='text-sm text-slate-500'>Average Ticket</div>
          <div className='text-2xl font-semibold'>
            {currency.format(salesTotals.avgTicket)}
          </div>
        </div>
      </div>

      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-2'>Sales by Sellers</h2>
        <DataTable columns={salesColumns} data={salesBySeller} />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mb-8'>
        <div>
          <h2 className='text-xl font-semibold mb-2'>Deals by Sales Rep</h2>
          <DataTable columns={dealsRepColumns} data={dealsByRep} />
        </div>
        <div>
          <h2 className='text-xl font-semibold mb-2'>Deals by Stage</h2>
          <DataTable columns={dealsStageColumns} data={dealsByStage} />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
        <div>
          <h2 className='text-xl font-semibold mb-2'>Customers by Source</h2>
          <DataTable columns={customersBySourceColumns} data={customersBySource} />
        </div>
        <div>
          <h2 className='text-xl font-semibold mb-2'>Customers by Sales Rep</h2>
          <DataTable columns={customersByRepColumns} data={customersByRep} />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mt-8'>
        <div className='border rounded p-4'>
          <div className='text-sm text-slate-500'>Total Customers</div>
          <div className='text-2xl font-semibold'>{customersTotals.total}</div>
        </div>
        <div className='border rounded p-4'>
          <div className='text-sm text-slate-500'>Without Sales Rep</div>
          <div className='text-2xl font-semibold'>{customersTotals.without_rep}</div>
        </div>
        <div className='border rounded p-4'>
          <div className='text-sm text-slate-500'>Invalid Leads</div>
          <div className='text-2xl font-semibold'>{customersTotals.invalid}</div>
        </div>
        <div className='border rounded p-4'>
          <div className='text-sm text-slate-500'>New (Last 30 Days)</div>
          <div className='text-2xl font-semibold'>{customersTotals.last_30}</div>
        </div>
      </div>
    </PageLayout>
  )
}
