import type { ColumnDef } from '@tanstack/react-table'
import { data, type LoaderFunctionArgs, useLoaderData } from 'react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
    invalid_lead: number
    out_of_area: number
    looking_for_unrelated_service: number
    accident_submission: number
  }>(
    db,
    `SELECT
           SUM(CASE WHEN c.invalid_lead = 'Invalid Lead' THEN 1 ELSE 0 END) AS invalid_lead,
           SUM(CASE WHEN c.invalid_lead = 'Out of Area' THEN 1 ELSE 0 END) AS out_of_area,
           SUM(CASE WHEN c.invalid_lead = 'Looking for unrelated service' THEN 1 ELSE 0 END) AS looking_for_unrelated_service,
           SUM(CASE WHEN c.invalid_lead = 'Accident submission' THEN 1 ELSE 0 END) AS accident_submission
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
      invalid_lead: 0,
      out_of_area: 0,
      looking_for_unrelated_service: 0,
      accident_submission: 0,
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
    status:
      dealStatusByCustomer.get(lead.id) &&
      deals.find(d => d.customer_id === lead.id)?.lost_reason
        ? deals.find(d => d.customer_id === lead.id)?.lost_reason
        : (dealStatusByCustomer.get(lead.id) ?? ''),
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

    { header: 'Amount', accessorKey: 'amount' },
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
          <div className='w-full h-[360px] max-w-[560px] bg-white border rounded-lg shadow-sm'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={[
                  { channel: 'Facebook', value: invalidStats.facebook },
                  { channel: 'Website', value: invalidStats.website },
                  { channel: 'Total', value: invalidStats.total },
                ]}
                margin={{ top: 20, right: 24, left: 12, bottom: 12 }}
              >
                <CartesianGrid
                  strokeDasharray='2 4'
                  vertical={false}
                  stroke='#e5e7eb'
                />
                <XAxis dataKey='channel' tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend verticalAlign='bottom' height={24} />
                <Bar dataKey='value' radius={[6, 6, 0, 0]}>
                  <Cell fill='#3b82f6' />
                  <Cell fill='#10b981' />
                  <Cell fill='#6b7280' />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className='w-full h-[360px] max-w-[560px] bg-white border rounded-lg shadow-sm'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={[
                  { reason: 'Invalid Lead', count: invalidReasons.invalid_lead },
                  { reason: 'Out of Area', count: invalidReasons.out_of_area },
                  {
                    reason: 'Unrelated service',
                    count: invalidReasons.looking_for_unrelated_service,
                  },
                  {
                    reason: 'Accident submission',
                    count: invalidReasons.accident_submission,
                  },
                ]}
                margin={{ top: 20, right: 24, left: 12, bottom: 12 }}
              >
                <CartesianGrid
                  strokeDasharray='2 4'
                  vertical={false}
                  stroke='#e5e7eb'
                />
                <XAxis dataKey='reason' tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend verticalAlign='bottom' height={24} />
                <Bar dataKey='count' radius={[6, 6, 0, 0]} fill='#f59e0b' />
              </BarChart>
            </ResponsiveContainer>
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
