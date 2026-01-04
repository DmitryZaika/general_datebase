import type { ColumnDef, Row } from '@tanstack/react-table'
import { format } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { DateRangeControls } from '~/components/molecules/DateRangeControls'
import { FindCustomer } from '~/components/molecules/FindCustomer'
import { SalesRepsFilter } from '~/components/molecules/SalesRepsFilter'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { db } from '~/db.server'
import { LOST_REASONS } from '~/utils/constants'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'


type DealsByRep = {
  rep_id: number
  rep_name: string
  deals_count: number
  avg_amount: number
  avg_amount_won: number
  won_count: number
  lost_count: number
  won_lost_ratio: number
  pipeline_amount: number
  won_count_walkin: number
  lost_count_walkin: number
  won_lost_ratio_walkin: number
  won_count_leads: number
  lost_count_leads: number
  won_lost_ratio_leads: number
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
  walkin: number
  leads: number
  manual: number
  total: number
}

type CustomersTableCustomer = {
  id: number
  name: string
  created_date: string
  source: string | null
  referral_source: string | null
  invalid_lead: string | null
  sales_rep_name: string | null
}

type CustomersTableDeal = {
  id: number
  customer_id: number
  sales_rep_name: string
  amount: number | null
  status: string | null
  lost_reason: string | null
}

type ConversionMetrics = {
  total_sold: number
  total_created: number
  leads_sold_same_month: number
  leads_created: number
  walkin_sold_same_month: number
  walkin_created: number
  callin_sold_same_month: number
  callin_created: number
}

type CustomersTableRow = {
  id: number
  created_date: string
  source: string
  referral_source: string
  name: string
  status: string
  lost_reason: string
  amount: string
  sales_rep_name: string
  className?: string
  createdSortValue?: number
}

type DealsList = { id: number; name: string; position: number }

type LostReasonsByRep = {
  rep_name: string
  lost_reason: string
  count: number
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) return redirect('/login')

    const url = new URL(request.url)
    const fromDate = url.searchParams.get('fromDate') || ''
    const toDate = url.searchParams.get('toDate') || ''
    const salesRepParam = url.searchParams.get('salesRep') || 'All'
    const hasRepFilter = salesRepParam !== 'All'

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

    const dealsDateFilters: string[] = []
    const dealsDateParams: (string | number)[] = []
    if (fromDate) {
      dealsDateFilters.push('DATE(d.updated_at) >= ?')
      dealsDateParams.push(fromDate)
    }
    if (toDate) {
      dealsDateFilters.push('DATE(d.updated_at) <= ?')
      dealsDateParams.push(toDate)
    }

    const salesWhere = [
      's.company_id = ?',
      's.cancelled_date IS NULL',
      's.sale_date IS NOT NULL',
      ...dateFilters,
    ]

    const dealsByRep = await selectMany<DealsByRep>(
      db,
      `SELECT u.id AS rep_id, u.name AS rep_name,
              COUNT(d.id) AS deals_count,
              COALESCE(AVG(NULLIF(d.amount, 0)), 0) AS avg_amount,
              COALESCE(
                SUM(
                  CASE
                    WHEN l.name = 'Closed Won' AND d.amount <> 0 THEN d.amount
                    ELSE 0
                  END
                ) /
                NULLIF(
                  SUM(
                    CASE
                      WHEN l.name = 'Closed Won' AND d.amount <> 0 THEN 1
                      ELSE 0
                    END
                  ),
                  0
                ),
              0) AS avg_amount_won,
              SUM(CASE WHEN l.name = 'Closed Won' THEN 1 ELSE 0 END) AS won_count,
              SUM(CASE WHEN l.name = 'Closed Lost' THEN 1 ELSE 0 END) AS lost_count,
              COALESCE(
                SUM(
                  CASE
                    WHEN l.name NOT IN ('Closed Won', 'Closed Lost') AND d.amount <> 0
                      THEN d.amount
                    ELSE 0
                  END
                ),
              0) AS pipeline_amount,
              CASE
                WHEN SUM(CASE WHEN l.name = 'Closed Won' THEN 1 ELSE 0 END) +
                     SUM(CASE WHEN l.name = 'Closed Lost' THEN 1 ELSE 0 END) = 0
                  THEN 0
                ELSE ROUND(
                  100 * SUM(CASE WHEN l.name = 'Closed Won' THEN 1 ELSE 0 END) /
                  (
                    SUM(CASE WHEN l.name = 'Closed Won' THEN 1 ELSE 0 END) +
                    SUM(CASE WHEN l.name = 'Closed Lost' THEN 1 ELSE 0 END)
                  ),
                  0
                )
              END AS won_lost_ratio,
              SUM(CASE WHEN l.name = 'Closed Won' AND c.source = 'check-in' THEN 1 ELSE 0 END) AS won_count_walkin,
              SUM(CASE WHEN l.name = 'Closed Lost' AND c.source = 'check-in' THEN 1 ELSE 0 END) AS lost_count_walkin,
              CASE
                WHEN SUM(CASE WHEN l.name = 'Closed Won' AND c.source = 'check-in' THEN 1 ELSE 0 END) +
                     SUM(CASE WHEN l.name = 'Closed Lost' AND c.source = 'check-in' THEN 1 ELSE 0 END) = 0
                  THEN 0
                ELSE ROUND(
                  100 * SUM(CASE WHEN l.name = 'Closed Won' AND c.source = 'check-in' THEN 1 ELSE 0 END) /
                  (
                    SUM(CASE WHEN l.name = 'Closed Won' AND c.source = 'check-in' THEN 1 ELSE 0 END) +
                    SUM(CASE WHEN l.name = 'Closed Lost' AND c.source = 'check-in' THEN 1 ELSE 0 END)
                  ),
                  0
                )
              END AS won_lost_ratio_walkin,
              SUM(CASE WHEN l.name = 'Closed Won' AND c.source = 'leads' THEN 1 ELSE 0 END) AS won_count_leads,
              SUM(CASE WHEN l.name = 'Closed Lost' AND c.source = 'leads' THEN 1 ELSE 0 END) AS lost_count_leads,
              CASE
                WHEN SUM(CASE WHEN l.name = 'Closed Won' AND c.source = 'leads' THEN 1 ELSE 0 END) +
                     SUM(CASE WHEN l.name = 'Closed Lost' AND c.source = 'leads' THEN 1 ELSE 0 END) = 0
                  THEN 0
                ELSE ROUND(
                  100 * SUM(CASE WHEN l.name = 'Closed Won' AND c.source = 'leads' THEN 1 ELSE 0 END) /
                  (
                    SUM(CASE WHEN l.name = 'Closed Won' AND c.source = 'leads' THEN 1 ELSE 0 END) +
                    SUM(CASE WHEN l.name = 'Closed Lost' AND c.source = 'leads' THEN 1 ELSE 0 END)
                  ),
                  0
                )
              END AS won_lost_ratio_leads
       FROM deals d
       JOIN users u ON d.user_id = u.id AND u.is_deleted = 0 AND u.company_id = ?
       JOIN deals_list l ON d.list_id = l.id
       JOIN customers c ON d.customer_id = c.id
       WHERE c.company_id = ? AND c.deleted_at IS NULL AND d.deleted_at IS NULL AND l.deleted_at IS NULL${
         dealsDateFilters.length ? ` AND ${dealsDateFilters.join(' AND ')}` : ''
       }${hasRepFilter ? ' AND u.name = ?' : ''}
       GROUP BY u.id, u.name
       ORDER BY deals_count DESC`,
      hasRepFilter
        ? [user.company_id, user.company_id, ...dealsDateParams, salesRepParam]
        : [user.company_id, user.company_id, ...dealsDateParams],
    )

    const dealsByStage = await selectMany<DealsByStage>(
      db,
      `SELECT l.name AS list_name,
              COUNT(d.id) AS deals_count,
              COALESCE(SUM(d.amount), 0) AS total_amount
       FROM deals d
       JOIN deals_list l ON d.list_id = l.id
       JOIN customers c ON d.customer_id = c.id
       JOIN users u ON d.user_id = u.id AND u.is_deleted = 0 AND u.company_id = ?
       WHERE c.company_id = ? AND c.deleted_at IS NULL AND d.deleted_at IS NULL AND l.deleted_at IS NULL${
         dealsDateFilters.length ? ` AND ${dealsDateFilters.join(' AND ')}` : ''
       }${hasRepFilter ? ' AND u.name = ?' : ''}
       GROUP BY l.id, l.name
       ORDER BY l.position ASC`,
      hasRepFilter
        ? [user.company_id, user.company_id, ...dealsDateParams, salesRepParam]
        : [user.company_id, user.company_id, ...dealsDateParams],
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
       WHERE company_id = ? AND deleted_at IS NULL`,
      [user.company_id],
    )

    const customersBySourceWhere: string[] = [
      'c.company_id = ?',
      'c.deleted_at IS NULL',
    ]
    const customersBySourceParams: (string | number)[] = [user.company_id]
    if (fromDate) {
      customersBySourceWhere.push('DATE(c.created_date) >= ?')
      customersBySourceParams.push(fromDate)
    }
    if (toDate) {
      customersBySourceWhere.push('DATE(c.created_date) <= ?')
      customersBySourceParams.push(toDate)
    }
    if (hasRepFilter) {
      customersBySourceWhere.push('u.name = ?')
      customersBySourceParams.push(salesRepParam)
    }

    const customersBySource = await selectMany<CustomersBySource>(
      db,
      `SELECT c.source, COUNT(*) AS total
       FROM customers c
       ${hasRepFilter ? 'JOIN users u ON c.sales_rep = u.id' : ''}
       WHERE ${customersBySourceWhere.join(' AND ')}
       GROUP BY c.source
       ORDER BY total DESC`,
      customersBySourceParams,
    )

    const customersByRepWhere: string[] = ['c.company_id = ?', 'c.deleted_at IS NULL']
    const customersByRepParams: (string | number)[] = [user.company_id]
    if (fromDate) {
      customersByRepWhere.push('DATE(c.created_date) >= ?')
      customersByRepParams.push(fromDate)
    }
    if (toDate) {
      customersByRepWhere.push('DATE(c.created_date) <= ?')
      customersByRepParams.push(toDate)
    }
    if (hasRepFilter) {
      customersByRepWhere.push('u.name = ?')
      customersByRepParams.push(salesRepParam)
    }

    const customersByRep = await selectMany<CustomersByRep>(
      db,
      `SELECT u.name AS rep_name,
              SUM(CASE WHEN c.source = 'check-in' THEN 1 ELSE 0 END) AS walkin,
              SUM(CASE WHEN c.source = 'leads' THEN 1 ELSE 0 END) AS leads,
              SUM(CASE WHEN c.source IN ('other','user-input') THEN 1 ELSE 0 END) AS manual,
              COUNT(c.id) AS total
       FROM customers c
       JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0 AND u.company_id = c.company_id
       JOIN users_positions up ON up.user_id = u.id
       JOIN positions p ON p.id = up.position_id AND LOWER(p.name) = 'sales_rep'
       WHERE ${customersByRepWhere.join(' AND ')} AND (c.invalid_lead IS NULL OR c.invalid_lead = '')
       GROUP BY u.name
       ORDER BY total DESC`,
      customersByRepParams,
    )

    const customersTableWhere: string[] = ['c.company_id = ?', 'c.deleted_at IS NULL']
    const customersTableParams: (string | number)[] = [user.company_id]
    if (fromDate) {
      customersTableWhere.push('DATE(c.created_date) >= ?')
      customersTableParams.push(fromDate)
    }
    if (toDate) {
      customersTableWhere.push('DATE(c.created_date) <= ?')
      customersTableParams.push(toDate)
    }

    const customersTable = await selectMany<CustomersTableCustomer>(
      db,
      `SELECT c.id,
              c.name,
              c.created_date,
              c.source,
              c.referral_source,
              c.invalid_lead,
              u.name as sales_rep_name
       FROM customers c
       LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0 AND u.company_id = c.company_id
       WHERE ${customersTableWhere.join(' AND ')}
       ORDER BY c.created_date DESC`,
      customersTableParams,
    )

    const customersDealsWhere: string[] = [
      'c.company_id = ?',
      'c.deleted_at IS NULL',
      'd.deleted_at IS NULL',
    ]
    const customersDealsParams: (string | number)[] = [user.company_id]
    if (fromDate) {
      customersDealsWhere.push('DATE(d.created_at) >= ?')
      customersDealsParams.push(fromDate)
    }
    if (toDate) {
      customersDealsWhere.push('DATE(d.created_at) <= ?')
      customersDealsParams.push(toDate)
    }

    const customersDeals = await selectMany<CustomersTableDeal>(
      db,
      `SELECT d.id,
              d.customer_id,
              d.amount,
              d.status,
              d.lost_reason,
              COALESCE(u.name, u2.name, '') as sales_rep_name
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       LEFT JOIN users u ON d.user_id = u.id AND u.is_deleted = 0 AND u.company_id = c.company_id
       LEFT JOIN users u2 ON c.sales_rep = u2.id AND u2.is_deleted = 0 AND u2.company_id = c.company_id
       WHERE ${customersDealsWhere.join(' AND ')}
       ORDER BY d.created_at DESC`,
      customersDealsParams,
    )

    const conversionMetricsWhere: string[] = [
      'c.company_id = ?',
      'c.deleted_at IS NULL',
      'd.deleted_at IS NULL',
      'dl.deleted_at IS NULL',
    ]
    const conversionMetricsParams: (string | number)[] = [user.company_id]
    if (fromDate) {
      conversionMetricsWhere.push('DATE(d.created_at) >= ?')
      conversionMetricsParams.push(fromDate)
    }
    if (toDate) {
      conversionMetricsWhere.push('DATE(d.created_at) <= ?')
      conversionMetricsParams.push(toDate)
    }
    if (hasRepFilter) {
      conversionMetricsWhere.push('u.name = ?')
      conversionMetricsParams.push(salesRepParam)
    }

    const conversionMetricsByRep = await selectMany<
      ConversionMetrics & { rep_name: string }
    >(
      db,
      `SELECT
         u.name as rep_name,
         COUNT(CASE WHEN dl.name = 'Closed Won' THEN 1 END) as total_sold,
         COUNT(*) as total_created,

         COUNT(CASE
             WHEN c.source = 'leads'
                  AND dl.name = 'Closed Won'
             THEN 1
         END) as leads_sold_same_month,
         COUNT(CASE WHEN c.source = 'leads' THEN 1 END) as leads_created,

         COUNT(CASE
             WHEN c.source = 'check-in'
                  AND dl.name = 'Closed Won'
             THEN 1
         END) as walkin_sold_same_month,
         COUNT(CASE WHEN c.source = 'check-in' THEN 1 END) as walkin_created,

         COUNT(CASE
             WHEN c.source = 'call-in'
                  AND dl.name = 'Closed Won'
             THEN 1
         END) as callin_sold_same_month,
         COUNT(CASE WHEN c.source = 'call-in' THEN 1 END) as callin_created

       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       JOIN deals_list dl ON d.list_id = dl.id
       JOIN users u ON d.user_id = u.id AND u.company_id = ?
       WHERE ${conversionMetricsWhere.join(' AND ')}
       GROUP BY u.name
       ORDER BY total_sold DESC`,
      [user.company_id, ...conversionMetricsParams],
    )

    const lists = await selectMany<DealsList>(
      db,
      `SELECT id, name, position FROM deals_list WHERE deleted_at IS NULL ORDER BY position`,
    )

    const lostReasonsByRep = await selectMany<LostReasonsByRep>(
      db,
      `SELECT u.name AS rep_name,
              d.lost_reason,
              COUNT(d.id) AS count
       FROM deals d
       JOIN users u ON d.user_id = u.id AND u.is_deleted = 0 AND u.company_id = ?
       JOIN deals_list l ON d.list_id = l.id
       JOIN customers c ON d.customer_id = c.id
       WHERE c.company_id = ?
         AND c.deleted_at IS NULL
         AND d.deleted_at IS NULL
         AND l.deleted_at IS NULL
         AND l.name = 'Closed Lost'
         AND d.lost_reason IS NOT NULL
         AND d.lost_reason <> ''${
           dealsDateFilters.length ? ` AND ${dealsDateFilters.join(' AND ')}` : ''
         }${hasRepFilter ? ' AND u.name = ?' : ''}
       GROUP BY u.name, d.lost_reason
       ORDER BY u.name, count DESC`,
      hasRepFilter
        ? [user.company_id, user.company_id, ...dealsDateParams, salesRepParam]
        : [user.company_id, user.company_id, ...dealsDateParams],
    )

    // === Top 8 campaigns by customers acquired + conversion %
    // === Conversion = Won / (Won + Lost) — only closed deals counted ===
    const customersByCampaign = await selectMany<{
      compaign_name: string
      customers_acquired: number
      closed_deals: number // won + lost
      won_deals: number
      conversion_percent: number
    }>(
      db,
      `SELECT
         c.compaign_name,
         COUNT(DISTINCT c.id) AS customers_acquired,
         COUNT(DISTINCT CASE WHEN d.list_id IN (4, 5) THEN d.id END) AS closed_deals,
         COUNT(DISTINCT CASE WHEN d.list_id = 4 THEN d.id END) AS won_deals,
         ROUND(
           100.0 *
           COUNT(DISTINCT CASE WHEN d.list_id = 4 THEN d.id END) /
           NULLIF(
             COUNT(DISTINCT CASE WHEN d.list_id IN (4, 5) THEN d.id END),
             0
           ),
           1
         ) AS conversion_percent
       FROM customers c
       INNER JOIN deals d
         ON d.customer_id = c.id
         AND d.deleted_at IS NULL
       WHERE c.company_id = ?
         AND c.deleted_at IS NULL
         AND c.invalid_lead IS NULL
         AND c.compaign_name IS NOT NULL
         AND TRIM(c.compaign_name) <> ''
         ${fromDate ? ' AND DATE(c.created_date) >= ?' : ''}
         ${toDate ? ' AND DATE(c.created_date) <= ?' : ''}
       GROUP BY c.compaign_name
       ORDER BY customers_acquired DESC
       LIMIT 8`,
      [user.company_id, ...(fromDate ? [fromDate] : []), ...(toDate ? [toDate] : [])],
    )

    return {
      dealsByRep,
      dealsByStage,
      lists,
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
      customersTable,
      customersDeals,
      conversionMetricsByRep,
      lostReasonsByRep,
      customersByCampaign,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function AdminStatistics() {
  const {
    dealsByRep,
    dealsByStage,
    lists,
    customersTotals,
    customersBySource,
    customersByRep,
    fromDate,
    toDate,
    customersTable,
    customersDeals,
    conversionMetricsByRep,
    lostReasonsByRep,
    customersByCampaign,
  } = useLoaderData<typeof loader>()

  const navigate = useNavigate()
  const location = useLocation()
  const [from, setFrom] = useState<Date | undefined>(
    fromDate ? new Date(fromDate) : undefined,
  )
  const [to, setTo] = useState<Date | undefined>(toDate ? new Date(toDate) : undefined)
  const [customersPage, setCustomersPage] = useState(1)
  const customersPageSize = 500
  const [highlightCustomerId, setHighlightCustomerId] = useState<number | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  const currency = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    [],
  )

  const conversionMetricsColumns: ColumnDef<{
    rep_name: string
    sold: string
    leads: string
    walkin: string
    callin: string
  }>[] = [
    { accessorKey: 'rep_name', header: 'Sales Rep' },
    { accessorKey: 'sold', header: 'Sold (Total)' },
    { accessorKey: 'leads', header: 'Closed Leads' },
    { accessorKey: 'walkin', header: 'Walk-in' },
    { accessorKey: 'callin', header: 'Call-in' },
  ]

  const conversionMetricsRows = useMemo(() => {
    return conversionMetricsByRep.map(m => ({
      rep_name: m.rep_name,
      sold:
        m.total_created > 0
          ? `${Math.round((m.total_sold / m.total_created) * 100)}%`
          : '0%',
      leads:
        m.leads_created > 0
          ? `${Math.round((m.leads_sold_same_month / m.leads_created) * 100)}%`
          : '0%',
      walkin:
        m.walkin_created > 0
          ? `${Math.round((m.walkin_sold_same_month / m.walkin_created) * 100)}%`
          : '0%',
      callin:
        m.callin_created > 0
          ? `${Math.round((m.callin_sold_same_month / m.callin_created) * 100)}%`
          : '0%',
    }))
  }, [conversionMetricsByRep])

  // const salesColumns: ColumnDef<SalesBySeller>[] = [
  //   { accessorKey: 'seller_name', header: 'Seller' },
  //   { accessorKey: 'sales_count', header: 'Sales' },
  //   {
  //     accessorKey: 'total_revenue',
  //     header: 'Total',
  //     cell: ({ row }) => currency.format(row.original.total_revenue || 0),
  //   },
  //   {
  //     accessorKey: 'avg_ticket',
  //     header: 'Average',
  //     cell: ({ row }) => currency.format(row.original.avg_ticket || 0),
  //   },
  // ]

  const dealsRepColumns: ColumnDef<DealsByRep>[] = [
    { accessorKey: 'rep_name', header: 'Sales Rep' },
    {
      accessorKey: 'avg_amount',
      header: 'Average Amount',
      cell: ({ row }) => currency.format(row.original.avg_amount || 0),
    },
    { accessorKey: 'won_count', header: 'Sales' },
    {
      accessorKey: 'avg_amount_won',
      header: 'Average Amount Won',
      cell: ({ row }) => (
        <span className='inline-block rounded px-2 py-1.5 -mt-2 -mb-2 bg-green-100 text-green-800'>
          {currency.format(row.original.avg_amount_won || 0)}
        </span>
      ),
    },
    {
      accessorKey: 'won_lost_ratio',
      header: 'Won %',
      cell: ({ row }) => (
        <span className='inline-block rounded px-2 py-1.5 -mt-2 -mb-2 bg-blue-100 text-blue-800'>
          {`${row.original.won_lost_ratio}%`}
        </span>
      ),
    },
    {
      accessorKey: 'won_lost_ratio_walkin',
      header: 'Walk-in Won %',
      cell: ({ row }) => (
        <span className='inline-block rounded px-2 py-1.5 -mt-2 -mb-2 bg-orange-100 text-orange-800'>
          {`${row.original.won_lost_ratio_walkin}%`}
        </span>
      ),
    },
    {
      accessorKey: 'won_lost_ratio_leads',
      header: 'Leads Won %',
      cell: ({ row }) => (
        <span className='inline-block rounded px-2 py-1.5 -mt-2 -mb-2 bg-purple-100 text-purple-800'>
          {`${row.original.won_lost_ratio_leads}%`}
        </span>
      ),
    },
  ]

  const stageRows = useMemo(() => {
    const map = new Map<string, DealsByStage>()
    dealsByStage.forEach(s => map.set(s.list_name, s))
    return lists.map(l => {
      const hit = map.get(l.name)
      return {
        list_name: l.name,
        deals_count: hit?.deals_count || 0,
        total_amount: hit?.total_amount || 0,
      } as DealsByStage
    })
  }, [JSON.stringify(dealsByStage), JSON.stringify(lists)])

  const totalDealsInStages = useMemo(
    () => stageRows.reduce((acc, s) => acc + (s.deals_count || 0), 0),
    [JSON.stringify(stageRows)],
  )

  const dealsStageColumns: ColumnDef<DealsByStage>[] = [
    { accessorKey: 'list_name', header: 'Stage' },
    {
      accessorKey: 'deals_count',
      header: 'Deals',
      cell: ({ row }) => {
        const count = row.original.deals_count || 0
        const pct =
          totalDealsInStages > 0 ? Math.round((count / totalDealsInStages) * 100) : 0
        return `${count} (${pct}%)`
      },
    },
    {
      accessorKey: 'total_amount',
      header: 'Total Amount',
      cell: ({ row }) => currency.format(row.original.total_amount || 0),
    },
  ]

  const sourceLabel = (s: string | null) => {
    if (!s) return '-'
    if (s === 'check-in') return 'Walk-in'
    if (s === 'leads') return 'Leads'
    if (s === 'user-input') return 'Other'
    if (s === 'other') return 'Other'
    return s
  }

  const customersBySourceColumns: ColumnDef<CustomersBySource>[] = [
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => sourceLabel(row.original.source),
    },
    { accessorKey: 'total', header: 'Customers' },
  ]

  const customersByRepColumns: ColumnDef<CustomersByRep>[] = [
    {
      accessorKey: 'rep_name',
      header: 'Sales Rep',
      cell: ({ row }) => row.original.rep_name || 'Not assigned',
    },
    { accessorKey: 'walkin', header: 'Walk-in' },
    { accessorKey: 'leads', header: 'Leads' },
    { accessorKey: 'manual', header: 'Manual added' },
    { accessorKey: 'total', header: 'Total' },
  ]

  const truncateValue = (value: string | number | null | undefined) => {
    const str = value === null || value === undefined ? '' : String(value)
    if (str.length > 20) return { text: `${str.slice(0, 20)}...`, title: str }
    return { text: str, title: str }
  }

  const renderTruncated = (value: string | number | null | undefined) => {
    const { text, title } = truncateValue(value)
    if (!title || text === title) return <span>{text}</span>
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='inline-block max-w-full truncate align-middle'>{text}</span>
        </TooltipTrigger>
        <TooltipContent side='top'>{title}</TooltipContent>
      </Tooltip>
    )
  }

  const customersColumns: ColumnDef<CustomersTableRow>[] = [
    {
      header: 'Date',
      accessorKey: 'created_date',
      cell: ({ row }) => renderTruncated(row.original.created_date),
    },
    {
      header: 'Source',
      accessorKey: 'source',
      cell: ({ row }) => renderTruncated(row.original.source),
    },
    {
      header: 'Sales Rep',
      accessorKey: 'sales_rep_name',
      cell: ({ row }) => renderTruncated(row.original.sales_rep_name),
    },
    {
      header: 'Reference',
      accessorKey: 'referral_source',
      cell: ({ row }) => renderTruncated(row.original.referral_source),
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => renderTruncated(row.original.name),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => renderTruncated(row.original.status),
    },
    {
      header: 'Lost reason',
      accessorKey: 'lost_reason',
      cell: ({ row }) => renderTruncated(row.original.lost_reason),
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      cell: ({ row }) => renderTruncated(row.original.amount),
    },
  ]

  const lostReasonColumns = useMemo(() => {
    const reasons = [...Object.values(LOST_REASONS), 'Other']

    return [
      {
        accessorKey: 'rep_name',
        header: 'Sales Rep',
        cell: ({ getValue }) => (
          <span className='font-medium'>{(getValue() as string) || 'Unknown'}</span>
        ),
      },
      ...reasons.map(reason => ({
        accessorKey: reason,
        header: reason,
        cell: ({ row }: { row: Row<any> }) => {
          const val = (row.original as any)[reason]
          if (!val) return '-'
          return (
            <div className='text-xs'>
              <div className='font-semibold'>{val.count}</div>
              <div className='text-gray-500'>{val.percent}%</div>
            </div>
          )
        },
      })),
      {
        accessorKey: 'total',
        header: 'Total Lost',
        cell: ({ row }) => {
          const totalLost = (row.original as any).total
          const totalDeals = (row.original as any).total_deals
          const pct = totalDeals > 0 ? Math.round((totalLost / totalDeals) * 100) : 0
          return (
            <div className='flex flex-col'>
              <span className='font-bold'>{totalLost}</span>
              <span className='text-xs text-muted-foreground'>{pct}% of all</span>
            </div>
          )
        },
      },
    ] as ColumnDef<unknown>[]
  }, [])

  const lostReasonRows = useMemo(() => {
    const map = new Map<string, any>()
    const standardReasons = new Set(Object.values(LOST_REASONS))

    // Lookup for total deals per rep
    const dealsCountByRep = new Map<string, number>()
    dealsByRep.forEach(d => dealsCountByRep.set(d.rep_name, d.deals_count))

    lostReasonsByRep.forEach(item => {
      if (!map.has(item.rep_name)) {
        map.set(item.rep_name, {
          rep_name: item.rep_name,
          total: 0,
          total_deals: dealsCountByRep.get(item.rep_name) || 0,
        })
      }
      const entry = map.get(item.rep_name)

      let reasonKey = item.lost_reason
      if (!standardReasons.has(reasonKey)) {
        reasonKey = 'Other'
      }

      if (!entry[reasonKey]) {
        entry[reasonKey] = { count: 0, percent: 0 }
      }
      entry[reasonKey].count += item.count

      entry.total += item.count
    })

    return Array.from(map.values()).map(entry => {
      Object.keys(entry).forEach(key => {
        if (key !== 'rep_name' && key !== 'total' && key !== 'total_deals') {
          const count = entry[key].count
          entry[key].percent = Math.round((count / entry.total) * 100)
        }
      })
      return entry
    })
  }, [lostReasonsByRep, dealsByRep])

  // === Customers Acquired by Campaign + Conversion % ===
  type CampaignAcquisition = {
    campaign_name: string
    customers_acquired: number
    conversion_percent: string // formatted as "XX.X%"
  }

  const campaignAcquisitionColumns: ColumnDef<CampaignAcquisition>[] = [
    { accessorKey: 'campaign_name', header: 'Campaign Name' },
    { accessorKey: 'customers_acquired', header: 'Customers Acquired' },
    {
      accessorKey: 'conversion_percent',
      header: 'Conversion %',
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.conversion_percent}</span>
      ),
    },
  ]

  const campaignAcquisitionRows = useMemo(() => {
    return customersByCampaign.map(row => ({
      campaign_name: row.compaign_name,
      customers_acquired: row.customers_acquired,
      conversion_percent:
        row.conversion_percent != null ? `${row.conversion_percent}%` : '0.0%',
    }))
  }, [customersByCampaign])

  const handleFiltersSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(location.search)
    if (from) params.set('fromDate', format(from, 'yyyy-MM-dd'))
    if (to) params.set('toDate', format(to, 'yyyy-MM-dd'))
    navigate({ pathname: '/admin/statistics', search: params.toString() })
  }

  const handleCurrentMonth = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    setFrom(firstDay)
    setTo(now)
    const params = new URLSearchParams(location.search)
    params.set('fromDate', format(firstDay, 'yyyy-MM-dd'))
    params.set('toDate', format(now, 'yyyy-MM-dd'))
    navigate({ pathname: '/admin/statistics', search: params.toString() })
  }

  const handleClear = () => {
    setFrom(undefined)
    setTo(undefined)
    const params = new URLSearchParams(location.search)
    params.delete('fromDate')
    params.delete('toDate')
    params.delete('salesRep')
    navigate({ pathname: '/admin/statistics', search: params.toString() })
  }

  const customerRows = useMemo(() => {
    const dealByCustomer = new Map<number, CustomersTableDeal>()
    customersDeals.forEach(deal => {
      if (!dealByCustomer.has(deal.customer_id)) {
        dealByCustomer.set(deal.customer_id, deal)
      }
    })
    return customersTable
      .map<CustomersTableRow>(customer => {
        const createdDate = new Date(customer.created_date)
        const deal = dealByCustomer.get(customer.id)
        const isInvalid = customer.invalid_lead && customer.invalid_lead !== ''
        const status = isInvalid ? 'Invalid' : deal?.status || ''
        const lostReason = isInvalid
          ? customer.invalid_lead || ''
          : deal?.lost_reason || ''
        const amount =
          deal?.amount && Number(deal.amount) > 0
            ? currency.format(Number(deal.amount))
            : ''
        const sourceValue =
          customer.source === 'check-in'
            ? 'Walk-In'
            : customer.source === 'leads'
              ? 'Leads'
              : customer.source || ''
        const referral =
          customer.referral_source === 'facebook-form'
            ? 'Facebook'
            : customer.referral_source === 'wordpress-form'
              ? 'Website'
              : customer.referral_source || ''
        return {
          id: customer.id,
          created_date: createdDate.toLocaleDateString(),
          createdSortValue: createdDate.getTime(),
          source: sourceValue,
          referral_source: referral,
          name: customer.name || '',
          status,
          lost_reason: lostReason,
          amount,
      sales_rep_name: customer.sales_rep_name || '',
        }
      })
      .sort((a, b) => (b.createdSortValue || 0) - (a.createdSortValue || 0))
  }, [customersTable, customersDeals, currency])

  const customersTotalPages = Math.max(
    1,
    Math.ceil(customerRows.length / customersPageSize),
  )
  const customersCurrentPage = Math.min(customersPage, customersTotalPages)
  const customersStartIndex = (customersCurrentPage - 1) * customersPageSize
  const customersEndIndex = customersStartIndex + customersPageSize
  const displayedCustomers = customerRows
    .slice(customersStartIndex, customersEndIndex)
    .map(row => ({
      ...row,
      className: `stats-customer-row-${row.id} ${
        highlightCustomerId === row.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''
      }`.trim(),
    }))

  return (
    <PageLayout title='Statistics'>
      <div className='sticky top-0 z-20 bg-gray-100 -mx-2 px-2 sm:-mx-5 sm:px-5 py-4 border-b mb-4 shadow-sm'>
        <div className='flex justify-between items-center'>
          <div className='flex items-center w-full'>
            <form
              onSubmit={handleFiltersSubmit}
              className='flex items-center justify-between gap-2 w-full'
            >
              <div className='flex items-center gap-2'>
                <SalesRepsFilter className='-mt-5' />
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  className='h-9'
                  onClick={handleCurrentMonth}
                >
                  Current month
                </Button>
                <DateRangeControls
                  from={from}
                  to={to}
                  setFrom={setFrom}
                  setTo={setTo}
                  onClear={handleClear}
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className='mb-8'></div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mb-8'>
        <div>
          <h2 className='text-xl font-semibold mb-2'>Deals by Sales Rep</h2>
          <DataTable columns={dealsRepColumns} data={dealsByRep} />
        </div>
        <div>
          <h2 className='text-xl font-semibold mb-2'>Deals by Stage</h2>
          <DataTable columns={dealsStageColumns} data={stageRows} />
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

      <div className='mt-12'>
        <h2 className='text-xl font-semibold mb-4'>
          Top Campaigns by Customers Acquired
        </h2>
        <p className='text-sm text-muted-foreground mb-4'>
          Conversion = Won Deals ÷ Total Deals per Campaign
        </p>
        <DataTable
          columns={campaignAcquisitionColumns}
          data={campaignAcquisitionRows}
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-8'>
        <div className='border rounded p-4 col-span-2'>
          <h2 className='text-xl font-semibold mb-2'>
            Conversion Metrics (by Deal Creation Date)
          </h2>
          <DataTable columns={conversionMetricsColumns} data={conversionMetricsRows} />
        </div>
      </div>

      {/* <div className='mt-8'>
        <h2 className='text-xl font-semibold mb-4'>Lost Reasons by Sales Rep</h2>
        <DataTable columns={lostReasonColumns} data={lostReasonRows} />
      </div> */}

      <div className='mt-8'>
        <div className='flex flex-col md:flex-row items-center justify-between mb-2'>
          <h2 className='text-xl font-semibold'>Customers</h2>
          <FindCustomer
            showActions={false}
            onSelect={customerId => {
              const index = customerRows.findIndex(row => row.id === customerId)
              const targetPage =
                index >= 0 ? Math.floor(index / customersPageSize) + 1 : 1
              setCustomersPage(targetPage)
              setTimeout(() => {
                const element = document.querySelector<HTMLElement>(
                  `.stats-customer-row-${customerId}`,
                )
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  setHighlightCustomerId(customerId)
                  if (highlightTimeoutRef.current) {
                    clearTimeout(highlightTimeoutRef.current)
                  }
                  highlightTimeoutRef.current = setTimeout(() => {
                    setHighlightCustomerId(null)
                  }, 2000)
                }
              }, 50)
            }}
          />
        </div>
        <DataTable columns={customersColumns} data={displayedCustomers} />
        <div className='mt-3 flex items-center justify-center gap-2'>
          <Button
            className='px-3 py-1 border rounded disabled:opacity-50'
            disabled={customersCurrentPage <= 1}
            onClick={() => setCustomersPage(customersCurrentPage - 1)}
          >
            Prev
          </Button>
          <span className='text-sm'>
            Page {customersCurrentPage} / {customersTotalPages}
          </span>
          <Button
            className='px-3 py-1 border rounded disabled:opacity-50'
            disabled={customersCurrentPage >= customersTotalPages}
            onClick={() => setCustomersPage(customersCurrentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </PageLayout>
  )
}
