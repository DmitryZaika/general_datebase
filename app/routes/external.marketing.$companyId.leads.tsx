import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import {
  data,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { DealsByStage } from '~/components/DealsByStage'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { DateRangeControls } from '~/components/molecules/DateRangeControls'
import { FindCustomer } from '~/components/molecules/FindCustomer'
import { RawObjectSelect } from '~/components/molecules/RawSelect'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getMarketingUser } from '~/utils/session.server'

interface Company {
  id: number
  name: string
}

interface Lead {
  id: number
  name: string
  // email: string
  // phone: string
  created_date: string
  source: string
  referral_source: string | null
  // sales_rep: number | null
  // sales_rep_name: string | null
  status?: string
  lost_reason?: string
  invalid_lead: string | null
  className?: string
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const companyId = Number(params.companyId)
  if (Number.isNaN(companyId) || !Number.isFinite(companyId) || companyId <= 0) {
    return redirect('/login?error=invalid_company_id')
  }
  try {
    await getMarketingUser(request, companyId)
  } catch {
    return redirect('/login')
  }
  const url = new URL(request.url)
  const fromDate = url.searchParams.get('fromDate') || ''
  const toDate = url.searchParams.get('toDate') || ''
  const view = url.searchParams.get('view') || 'leads'
  const channel = (url.searchParams.get('channel') || 'all').toLowerCase()

  const referralFilter =
    channel === 'facebook'
      ? " AND c.referral_source = 'facebook-form'"
      : channel === 'website'
        ? " AND c.referral_source = 'wordpress-form'"
        : ''

  const whereSource =
    view === 'leads'
      ? "c.source = 'leads'"
      : view === 'walkins'
        ? "c.source = 'check-in'"
        : "(c.source = 'leads' OR c.source = 'check-in')"

  const sourceFilterCase =
    view === 'total'
      ? ''
      : view === 'leads'
        ? " AND c.source = 'leads'"
        : " AND c.source = 'check-in'"
  const leads = await selectMany<Lead>(
    db,
    `SELECT c.id, c.name, c.email, c.phone, c.created_date, c.source, c.referral_source, c.sales_rep, u.name AS sales_rep_name, c.invalid_lead
         FROM customers c
         LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
         WHERE ${whereSource} AND c.deleted_at IS NULL
           ${fromDate ? ' AND DATE(c.created_date) >= ?' : ''}
           ${toDate ? ' AND DATE(c.created_date) <= ?' : ''}
           AND c.company_id = ?${referralFilter}`,
    [
      ...([fromDate].filter(Boolean) as string[]),
      ...([toDate].filter(Boolean) as string[]),
      companyId,
    ],
  )

  const deals = await selectMany<{
    id: number
    customer_id: number
    list_id: number
    amount: number
    description: string
    status: string
    lost_reason: string
  }>(
    db,
    `SELECT d.id, d.customer_id, d.list_id, d.amount, d.description, d.status, d.lost_reason
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       WHERE ${whereSource} AND d.deleted_at IS NULL
         ${fromDate ? ' AND DATE(d.created_at) >= ?' : ''}
         ${toDate ? ' AND DATE(d.created_at) <= ?' : ''}
         AND c.company_id = ?${referralFilter}`,
    [
      ...([fromDate].filter(Boolean) as string[]),
      ...([toDate].filter(Boolean) as string[]),
      companyId,
    ],
  )

  const lists = await selectMany<{ id: number; name: string; position: number }>(
    db,
    'SELECT id, name, position FROM deals_list WHERE deleted_at IS NULL ORDER BY position',
  )

  const invalidStats = await selectMany<{
    facebook: number
    website: number
    total: number
  }>(
    db,
    `SELECT
          SUM(CASE WHEN c.referral_source = 'facebook-form' AND c.invalid_lead IS NOT NULL AND c.invalid_lead <> ''${sourceFilterCase} THEN 1 ELSE 0 END) AS facebook,
          SUM(CASE WHEN c.referral_source = 'wordpress-form' AND c.invalid_lead IS NOT NULL AND c.invalid_lead <> ''${sourceFilterCase} THEN 1 ELSE 0 END) AS website,
           SUM(CASE WHEN c.invalid_lead IS NOT NULL AND c.invalid_lead <> '' THEN 1 ELSE 0 END) AS total
         FROM customers c
        WHERE (c.source = 'leads' OR c.source = 'check-in') AND c.deleted_at IS NULL
         ${fromDate ? ' AND DATE(c.created_date) >= ?' : ''}
         ${toDate ? ' AND DATE(c.created_date) <= ?' : ''}
         AND c.company_id = ?${referralFilter}`,
    [
      ...([fromDate].filter(Boolean) as string[]),
      ...([toDate].filter(Boolean) as string[]),
      companyId,
    ],
  )

  const invalidReasons = await selectMany<{
    too_expensive: number
    out_of_area: number
    never_responded: number
    wrong_contact: number
    accident_submission: number
    unrelated_service: number
    bought_elsewhere: number
    stopped_responding: number
  }>(
    db,
    `SELECT
           SUM(CASE WHEN d.lost_reason = 'Too expensive' THEN 1 ELSE 0 END) AS too_expensive,
           (
             SUM(CASE WHEN d.lost_reason = 'Out of area' THEN 1 ELSE 0 END)
             + COUNT(DISTINCT CASE WHEN c.invalid_lead = 'Out of area' THEN c.id END)
           ) AS out_of_area,
           SUM(CASE WHEN d.lost_reason = 'Never responded' THEN 1 ELSE 0 END) AS never_responded,
           (
             SUM(CASE WHEN d.lost_reason IN ('Wrong number, email, etc.', 'Wrong number, email, etc') THEN 1 ELSE 0 END)
             + COUNT(DISTINCT CASE WHEN c.invalid_lead IN ('Wrong number, email, etc.', 'Wrong number, email, etc') THEN c.id END)
           ) AS wrong_contact,
           SUM(CASE WHEN d.lost_reason = 'Accident submission' THEN 1 ELSE 0 END) AS accident_submission,
           SUM(CASE WHEN d.lost_reason = 'Looking for unrelated service' THEN 1 ELSE 0 END) AS unrelated_service,
           SUM(CASE WHEN d.lost_reason = 'Bought somewhere else' THEN 1 ELSE 0 END) AS bought_elsewhere,
           SUM(CASE WHEN d.lost_reason = 'Stoped responding' THEN 1 ELSE 0 END) AS stopped_responding
         FROM customers c
         LEFT JOIN deals d ON d.customer_id = c.id
      WHERE ${whereSource} AND c.deleted_at IS NULL
         ${fromDate ? ' AND DATE(c.created_date) >= ?' : ''}
         ${toDate ? ' AND DATE(c.created_date) <= ?' : ''}
         AND c.company_id = ?${referralFilter}`,
    [
      ...([fromDate].filter(Boolean) as string[]),
      ...([toDate].filter(Boolean) as string[]),
      companyId,
    ],
  )

  return data({
    companyId,
    leads,
    deals,
    lists,
    fromDate,
    toDate,
    view,
    channel,
    invalidStats: invalidStats[0] || { facebook: 0, website: 0, total: 0 },
    invalidReasons: invalidReasons[0] || {
      too_expensive: 0,
      out_of_area: 0,
      never_responded: 0,
      wrong_contact: 0,
      accident_submission: 0,
      unrelated_service: 0,
      bought_elsewhere: 0,
      stopped_responding: 0,
    },
  })
}

async function fetchCompanies(): Promise<Company[]> {
  const res = await fetch(`/api/user/allCompanies`)
  if (!res.ok) throw new Error('Failed to fetch companies')
  const json = await res.json()
  return json.companies
}

function ExternalMarketingLeads() {
  const {
    companyId,
    leads,
    deals,
    lists,
    fromDate,
    toDate,
    view,
    channel,
    invalidStats,
    invalidReasons,
  } = useLoaderData<typeof loader>()
  const dealStatusByCustomer = new Map<number, string>()
  for (const d of deals) {
    if (!dealStatusByCustomer.has(d.customer_id))
      dealStatusByCustomer.set(d.customer_id, d.status)
  }

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  })

  const cleanCompanies = companies.map(c => ({ key: c.id.toString(), value: c.name }))

  const rows: Lead[] = leads.map(lead => ({
    id: lead.id,
    created_date: new Date(lead.created_date).toLocaleDateString(),
    // sales_rep: lead.sales_rep ?? null,
    // sales_rep_name: lead.sales_rep_name ?? null,
    source:
      lead.source === 'check-in'
        ? 'Walk-In'
        : lead.source === 'leads'
          ? 'Leads'
          : (lead.source ?? ''),
    referral_source:
      lead.referral_source === 'facebook-form'
        ? 'Facebook'
        : lead.referral_source === 'wordpress-form'
          ? 'Website'
          : (lead.referral_source ?? ''),
    name: lead.name,
    // phone: lead.phone,
    // email: lead.email,
    status:
      lead.invalid_lead && lead.invalid_lead !== ''
        ? 'Invalid'
        : (dealStatusByCustomer.get(lead.id) ?? ''),
    lost_reason:
      lead.invalid_lead && lead.invalid_lead !== ''
        ? lead.invalid_lead
        : deals.find(d => d.customer_id === lead.id)?.lost_reason || '',
    amount: deals.find(d => d.customer_id === lead.id)?.amount
      ? `$${deals.find(d => d.customer_id === lead.id)?.amount}`
      : '',
    invalid_lead: lead.invalid_lead ?? null,
  }))
  const columns: ColumnDef<Lead>[] = [
    { header: 'Date', accessorKey: 'created_date' },
    { header: 'Source', accessorKey: 'source' },
    { header: 'Reference', accessorKey: 'referral_source' },
    { header: 'Name', accessorKey: 'name' },
    // { header: "Phone number", accessorKey: "phone" },
    // { header: "E-mail", accessorKey: "email" },
    // { header: "Sales Person", accessorKey: "sales_rep_name" },
    { header: 'Status', accessorKey: 'status' },
    { header: 'Lost reason', accessorKey: 'lost_reason' },

    { header: 'Amount', accessorKey: 'amount' },
    {
      id: 'actions',
      meta: {
        className: 'w-[50px]',
      },
      cell: ({ row }) => {
        return (
          <ActionDropdown
            actions={{
              edit: `edit/${row.original.id}`,
              delete: `delete/${row.original.id}`,
            }}
          />
        )
      },
    },
  ]

  const facebookCount = Number(invalidStats.facebook || 0)
  const websiteCount = Number(invalidStats.website || 0)
  const totalChannel = facebookCount + websiteCount
  const channelRows = [
    { name: 'Facebook', count: facebookCount },
    { name: 'Website', count: websiteCount },
    { name: 'Total', count: totalChannel },
  ]
  const channelColumns: ColumnDef<{ name: string; count: number }>[] = [
    { accessorKey: 'name', header: 'Channel' },
    {
      accessorKey: 'count',
      header: 'Leads',
      cell: ({ row }) => {
        const c = Number(row.original.count || 0)
        if (row.original.name === 'Total') {
          return `${c}`
        }
        const pct = totalChannel > 0 ? Math.round((c / totalChannel) * 100) : 0
        return `${c} (${pct}%)`
      },
    },
  ]

  const reasonRows = [
    { name: 'Too expensive', count: Number(invalidReasons.too_expensive || 0) },
    { name: 'Out of area', count: Number(invalidReasons.out_of_area || 0) },
    { name: 'Never responded', count: Number(invalidReasons.never_responded || 0) },
    {
      name: 'Wrong number, email, etc.',
      count: Number(invalidReasons.wrong_contact || 0),
    },
    {
      name: 'Accident submission',
      count: Number(invalidReasons.accident_submission || 0),
    },
    {
      name: 'Looking for unrelated service',
      count: Number(invalidReasons.unrelated_service || 0),
    },
    {
      name: 'Bought somewhere else',
      count: Number(invalidReasons.bought_elsewhere || 0),
    },
    {
      name: 'Stopped responding',
      count: Number(invalidReasons.stopped_responding || 0),
    },
  ]
  const totalReasons = reasonRows.reduce((acc, r) => acc + Number(r.count || 0), 0)
  const reasonColumns: ColumnDef<{ name: string; count: number }>[] = [
    { accessorKey: 'name', header: 'Reason' },
    {
      accessorKey: 'count',
      header: 'Leads',
      cell: ({ row }) => {
        const c = Number(row.original.count || 0)
        const pct = totalReasons > 0 ? Math.round((c / totalReasons) * 100) : 0
        return `${c} (${pct}%)`
      },
    },
  ]

  const navigate = useNavigate()
  const location = useLocation()

  function applyDates(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(location.search)
    if (from) params.set('fromDate', format(from, 'yyyy-MM-dd'))
    else params.delete('fromDate')
    if (to) params.set('toDate', format(to, 'yyyy-MM-dd'))
    else params.delete('toDate')
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const [from, setFrom] = useState<Date | undefined>(
    fromDate ? new Date(fromDate) : undefined,
  )
  const [to, setTo] = useState<Date | undefined>(toDate ? new Date(toDate) : undefined)
  const [page, setPage] = useState(1)
  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const displayedRows = rows.slice(startIndex, endIndex)

  const [highlightLeadId, setHighlightLeadId] = useState<number | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const highlightParam = params.get('highlight')
    const id = highlightParam ? Number(highlightParam) : 0
    if (!id) return
    setTimeout(() => {
      const el = document.querySelector(`.lead-row-${id}`) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightLeadId(id)
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightLeadId(null)
        }, 2000)
      }
      const clean = new URLSearchParams(location.search)
      clean.delete('highlight')
      navigate(
        { pathname: location.pathname, search: clean.toString() },
        { replace: true },
      )
    }, 50)
  }, [location.search, navigate, location.pathname])

  const displayed: Lead[] = displayedRows.map(lead => ({
    ...lead,
    className:
      `lead-row-${lead.id} ${highlightLeadId === lead.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`.trim(),
  }))

  return (
    <div>
      <PageLayout title='Marketing'>
        <div className='w-fit mb-2'>
          {companies.length > 1 && (
            <RawObjectSelect
              label='Company'
              options={cleanCompanies}
              value={companyId.toString()}
              onChange={key => {
                navigate(`/external/marketing/${key}/leads`)
              }}
            />
          )}
        </div>
        <Button
          type='button'
          className='w-fit'
          onClick={() => navigate(`/external/marketing/${companyId}/leads/add_lead`)}
        >
          Add Lead
        </Button>
        <form onSubmit={applyDates} className='mb-4 flex items-center gap-2'>
          <DateRangeControls
            from={from}
            to={to}
            setFrom={d => setFrom(d)}
            setTo={d => setTo(d)}
            onClear={() => {
              setFrom(undefined)
              setTo(undefined)
              const params = new URLSearchParams(location.search)
              params.delete('fromDate')
              params.delete('toDate')
              navigate({ pathname: location.pathname, search: params.toString() })
            }}
            applyButtonType='submit'
          />
        </form>
        <div className='mb-6 w-fit'>
          <Tabs
            value={view}
            onValueChange={val => {
              const params = new URLSearchParams(location.search)
              params.set('view', val)
              if (val === 'walkins' || val === 'total') params.delete('channel')
              navigate({ pathname: location.pathname, search: params.toString() })
            }}
            className='mt-4'
          >
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='leads'>Leads</TabsTrigger>
              <TabsTrigger value='walkins'>Walk-ins</TabsTrigger>
              <TabsTrigger value='total'>Total</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs
            value={channel}
            onValueChange={val => {
              const params = new URLSearchParams(location.search)
              params.set('channel', val)
              navigate({ pathname: location.pathname, search: params.toString() })
            }}
            className='mt-2'
          >
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='all'>All</TabsTrigger>
              {view === 'leads' && (
                <>
                  {' '}
                  <TabsTrigger value='facebook'>Facebook</TabsTrigger>
                  <TabsTrigger value='website'>Website</TabsTrigger>
                </>
              )}
            </TabsList>
          </Tabs>
        </div>
        <div className='mb-6 gap-6 flex flex-row items-stretch'>
          <div className='w-full'>
            <h2 className='text-xl font-semibold mb-2'>Invalid by Channel</h2>
            <DataTable columns={channelColumns} data={channelRows} />
          </div>
          <div className='w-full'>
            <h2 className='text-xl font-semibold mb-2'>Invalid Reasons</h2>
            <DataTable columns={reasonColumns} data={reasonRows} />
          </div>
          <div className='mb-6'>
            <h2 className='text-xl font-semibold mb-2'>Deals by Stage</h2>
            <DealsByStage
              deals={deals.map(d => ({
                id: d.id,
                list_id: d.list_id,
                amount: d.amount,
              }))}
              lists={lists}
            />
          </div>
        </div>
        <div className='flex items-center gap-2 justify-end'>
          <FindCustomer
            buildSearchUrl={(term, searchType) =>
              `/external/api/customers/search/${companyId}?term=${encodeURIComponent(term)}&searchType=${searchType}`
            }
            buildEditLink={(id, search) =>
              `/external/marketing/${companyId}/leads/edit/${id}${search}`
            }
            buildDeleteLink={(id, search) =>
              `/external/marketing/${companyId}/leads/delete/${id}${search}`
            }
            onSelect={customerId => {
              const index = rows.findIndex(r => r.id === customerId)
              const targetPage = index >= 0 ? Math.floor(index / pageSize) + 1 : 1
              setPage(targetPage)
              const params = new URLSearchParams(location.search)
              params.set('company_id', companyId.toString())
              params.set('highlight', String(customerId))
              navigate({ pathname: location.pathname, search: params.toString() })
            }}
          />
        </div>
        <DataTable columns={columns} data={displayed} />
        <div className='mt-3 flex items-center justify-center gap-2'>
          <Button
            className='px-3 py-1 rounded disabled:opacity-50'
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Prev
          </Button>
          <span className='text-sm'>
            Page {currentPage} / {totalPages}
          </span>
          <Button
            className='px-3 py-1 rounded disabled:opacity-50'
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </PageLayout>
      <Outlet />
    </div>
  )
}

export default ExternalMarketingLeads
