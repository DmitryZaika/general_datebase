import type { ColumnDef } from '@tanstack/react-table'
import { data, type LoaderFunctionArgs, useLoaderData } from 'react-router'
import { DealsByStage } from '~/components/DealsByStage'
import { DateRangeControls } from '~/components/molecules/DateRangeControls'
import { PageLayout } from '~/components/PageLayout'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

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
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await getEmployeeUser(request)
  const url = new URL(request.url)
  const fromDate = url.searchParams.get('fromDate') || ''
  const toDate = url.searchParams.get('toDate') || ''
  const leads = await selectMany<Lead>(
    db,
    `SELECT c.id, c.name, c.email, c.phone, c.created_date, c.source, c.referral_source, c.sales_rep, u.name AS sales_rep_name
         FROM customers c
         LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
         WHERE c.source = 'leads' OR c.source = 'check-in'`,
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
    'SELECT id, customer_id, list_id, amount, description, status, lost_reason FROM deals',
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
           SUM(CASE WHEN c.referral_source = 'facebook-form' AND c.invalid_lead IS NOT NULL AND c.invalid_lead <> '' THEN 1 ELSE 0 END) AS facebook,
           SUM(CASE WHEN c.referral_source = 'wordpress-form' AND c.invalid_lead IS NOT NULL AND c.invalid_lead <> '' THEN 1 ELSE 0 END) AS website,
           SUM(CASE WHEN c.invalid_lead IS NOT NULL AND c.invalid_lead <> '' THEN 1 ELSE 0 END) AS total
         FROM customers c
         WHERE (c.source = 'leads' OR c.source = 'check-in')
         ${fromDate ? ' AND DATE(c.created_date) >= ?' : ''}
         ${toDate ? ' AND DATE(c.created_date) <= ?' : ''}`,
    [
      ...([fromDate].filter(Boolean) as string[]),
      ...([toDate].filter(Boolean) as string[]),
    ],
  )

  const invalidReasons = await selectMany<{
    too_expensive: number
    out_of_area: number
    no_response: number
    wrong_contact: number
    accident_submission: number
    unrelated_service: number
    bought_elsewhere: number
  }>(
    db,
    `SELECT
           SUM(CASE WHEN c.invalid_lead = 'Too expensive' THEN 1 ELSE 0 END) AS too_expensive,
           SUM(CASE WHEN c.invalid_lead = 'Out of area' THEN 1 ELSE 0 END) AS out_of_area,
           SUM(CASE WHEN c.invalid_lead = 'No response' THEN 1 ELSE 0 END) AS no_response,
           SUM(CASE WHEN c.invalid_lead = 'Wrong number, email, etc.' THEN 1 ELSE 0 END) AS wrong_contact,
           SUM(CASE WHEN c.invalid_lead = 'Accident submission' THEN 1 ELSE 0 END) AS accident_submission,
           SUM(CASE WHEN c.invalid_lead = 'Looking for unrelated service' THEN 1 ELSE 0 END) AS unrelated_service,
           SUM(CASE WHEN c.invalid_lead = 'Bought somewhere else' THEN 1 ELSE 0 END) AS bought_elsewhere
         FROM customers c
         WHERE (c.source = 'leads' OR c.source = 'check-in')
           AND c.invalid_lead IS NOT NULL AND c.invalid_lead <> ''
           ${fromDate ? ' AND DATE(c.created_date) >= ?' : ''}
           ${toDate ? ' AND DATE(c.created_date) <= ?' : ''}`,
    [
      ...([fromDate].filter(Boolean) as string[]),
      ...([toDate].filter(Boolean) as string[]),
    ],
  )

  return data({
    leads,
    deals,
    lists,
    fromDate,
    toDate,
    invalidStats: invalidStats[0] || { facebook: 0, website: 0, total: 0 },
    invalidReasons: invalidReasons[0] || {
      too_expensive: 0,
      out_of_area: 0,
      no_response: 0,
      wrong_contact: 0,
      accident_submission: 0,
      unrelated_service: 0,
      bought_elsewhere: 0,
    },
  })
}

function ExternalMarketingLeads() {
  const { leads, deals, lists, fromDate, toDate, invalidStats, invalidReasons } =
    useLoaderData<typeof loader>()
  const dealStatusByCustomer = new Map<number, string>()
  for (const d of deals) {
    if (!dealStatusByCustomer.has(d.customer_id))
      dealStatusByCustomer.set(d.customer_id, d.status)
  }

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
    status: dealStatusByCustomer.get(lead.id) ?? '',
    lost_reason: deals.find(d => d.customer_id === lead.id)?.lost_reason || '',
    amount: deals.find(d => d.customer_id === lead.id)?.amount
      ? `$${deals.find(d => d.customer_id === lead.id)?.amount}`
      : '',
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
  ]

  const channelRows = [
    { name: 'Facebook', count: Number(invalidStats.facebook || 0) },
    { name: 'Website', count: Number(invalidStats.website || 0) },
  ]
  const totalChannel = Number(invalidStats.total || 0)
  const channelColumns: ColumnDef<{ name: string; count: number }>[] = [
    { accessorKey: 'name', header: 'Channel' },
    {
      accessorKey: 'count',
      header: 'Leads',
      cell: ({ row }) => {
        const c = Number(row.original.count || 0)
        const pct = totalChannel > 0 ? Math.round((c / totalChannel) * 100) : 0
        return `${c} (${pct}%)`
      },
    },
  ]

  const reasonRows = [
    { name: 'Too expensive', count: Number(invalidReasons.too_expensive || 0) },
    { name: 'Out of area', count: Number(invalidReasons.out_of_area || 0) },
    { name: 'No response', count: Number(invalidReasons.no_response || 0) },
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

  function applyDates(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(window.location.search)
    if (_fromValue) params.set('fromDate', _fromValue)
    if (_toValue) params.set('toDate', _toValue)
    window.location.href = `${window.location.pathname}?${params.toString()}`
  }

  let _fromValue = fromDate || ''
  let _toValue = toDate || ''

  return (
    <div>
      <PageLayout title='External Marketing Leads'>
        <form onSubmit={applyDates} className='mb-4 flex items-center gap-2'>
          <DateRangeControls
            from={fromDate ? new Date(fromDate) : undefined}
            to={toDate ? new Date(toDate) : undefined}
            setFrom={d => {
              _fromValue = d ? d.toISOString().slice(0, 10) : ''
            }}
            setTo={d => {
              _toValue = d ? d.toISOString().slice(0, 10) : ''
            }}
            onClear={() => {
              const params = new URLSearchParams(window.location.search)
              params.delete('fromDate')
              params.delete('toDate')
              window.location.href = `${window.location.pathname}?${params.toString()}`
            }}
            applyButtonType='submit'
          />
        </form>
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
        <DataTable columns={columns} data={rows} />
      </PageLayout>
    </div>
  )
}

export default ExternalMarketingLeads
