import type { ColumnDef, Row } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, User } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { DataTable } from '~/components/ui/data-table'
import { DataTablePagination } from '~/components/ui/data-table-pagination'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { db } from '~/db.server'
import { type Calls200Response, fetchValue } from '~/utils/cloudtalk.server'
import { phoneDigitsOnly } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface SalesRep {
  id: number
  name: string
  email: string
  cloudtalk_agent_id: string | null
}

interface UserActivity {
  id: number
  source: string
  user_id: number | null
  user_name: string | null
  action: string
  created_at: string
  customer_name: string | null
}

interface SmsActivityRow {
  id: number
  source: string
  user_id: number | null
  user_name: string | null
  action: string
  created_at: string
  sender: string
  recipient: string
}

interface CustomerPhoneRow {
  name: string
  phone: string | null
  phone_2: string | null
}

function lastPhoneDigits10(value: string): string | null {
  const d = phoneDigitsOnly(value)
  if (d.length < 10) return null
  return d.slice(-10)
}

function buildCustomerLast10NameMap(rows: CustomerPhoneRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    for (const raw of [row.phone, row.phone_2]) {
      if (!raw) continue
      const key = lastPhoneDigits10(raw)
      if (key) map.set(key, row.name)
    }
  }
  return map
}

function customerNameForSmsParty(
  sender: string,
  recipient: string,
  last10ToName: Map<string, string>,
): string | null {
  const s = lastPhoneDigits10(sender)
  const r = lastPhoneDigits10(recipient)
  if (r) {
    const hit = last10ToName.get(r)
    if (hit) return hit
  }
  if (s) {
    const hit = last10ToName.get(s)
    if (hit) return hit
  }
  return null
}

type DatePreset = '1d' | '7d' | '30d' | '90d' | 'all'

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: '1d', label: '1d' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All time' },
]

function daysAgoDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function todayDate(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function getActivePreset(dateFrom?: Date, dateTo?: Date): DatePreset | null {
  if (!dateFrom && !dateTo) return 'all'
  if (!dateFrom) return null
  if (dateTo && isSameDay(dateFrom, startOfToday()) && isSameDay(dateTo, new Date()))
    return '1d'
  if (isSameDay(dateFrom, daysAgoDate(7))) return '7d'
  if (isSameDay(dateFrom, daysAgoDate(30))) return '30d'
  if (isSameDay(dateFrom, daysAgoDate(90))) return '90d'
  return null
}

function DateRangePicker({
  dateFrom,
  dateTo,
  onRangeChange,
  onPreset,
}: {
  dateFrom?: Date
  dateTo?: Date
  onRangeChange: (range?: DateRange) => void
  onPreset: (preset: DatePreset) => void
}) {
  const activePreset = getActivePreset(dateFrom, dateTo)
  const label =
    dateFrom && dateTo
      ? `${format(dateFrom, 'M/d/yyyy')} - ${format(dateTo, 'M/d/yyyy')}`
      : dateFrom
        ? `${format(dateFrom, 'M/d/yyyy')} - ...`
        : 'Pick dates'

  return (
    <div className='flex items-center gap-1 flex-wrap'>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline' size='sm' className='text-xs gap-1 ml-1'>
            <CalendarDays size={12} />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            mode='range'
            selected={dateFrom ? { from: dateFrom, to: dateTo } : undefined}
            onSelect={onRangeChange}
          />
        </PopoverContent>
      </Popover>
      {DATE_PRESETS.map(p => (
        <button
          key={p.value}
          type='button'
          onClick={() => onPreset(p.value)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            activePreset === p.value
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function GeneralActivitySortHeader({
  title,
  sortKey,
  sort,
  onToggle,
}: {
  title: string
  sortKey: string
  sort: { key: string | null; order: 'asc' | 'desc' }
  onToggle: (key: string) => void
}) {
  const isSorted = sort.key === sortKey
  const order = sort.order

  return (
    <Button
      variant='ghost'
      type='button'
      onClick={e => {
        e.stopPropagation()
        onToggle(sortKey)
      }}
      className='-ml-3 h-8 p-0 px-2 font-medium hover:bg-slate-100'
    >
      {title}
      {isSorted ? (
        order === 'asc' ? (
          <ArrowUp className='ml-2 h-4 w-4 text-slate-900' />
        ) : (
          <ArrowDown className='ml-2 h-4 w-4 text-slate-900' />
        )
      ) : (
        <ArrowUpDown className='ml-2 h-4 w-4 text-slate-400 opacity-50' />
      )}
    </Button>
  )
}

function compareActivityRows(
  a: UserActivity,
  b: UserActivity,
  sortKey: string,
  order: 'asc' | 'desc',
): number {
  let cmp = 0
  if (sortKey === 'created_at') {
    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  } else if (sortKey === 'customer_name') {
    const av = (a.customer_name ?? '').toLowerCase()
    const bv = (b.customer_name ?? '').toLowerCase()
    cmp = av < bv ? -1 : av > bv ? 1 : 0
  } else if (sortKey === 'user_name') {
    const av = (a.user_name ?? '').toLowerCase()
    const bv = (b.user_name ?? '').toLowerCase()
    cmp = av < bv ? -1 : av > bv ? 1 : 0
  } else if (sortKey === 'action') {
    const av = (a.action ?? '').toLowerCase()
    const bv = (b.action ?? '').toLowerCase()
    cmp = av < bv ? -1 : av > bv ? 1 : 0
  }
  return order === 'asc' ? cmp : -cmp
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: { company_id: number }
  try {
    const sessionUser = await getAdminUser(request)
    user = {
      company_id: sessionUser.company_id,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const salesReps = await selectMany<SalesRep>(
    db,
    `SELECT u.id, u.name, u.email, u.cloudtalk_agent_id
      FROM users u
      JOIN users_positions up ON up.user_id = u.id
      JOIN positions p ON p.id = up.position_id
      WHERE u.is_deleted = 0
        AND LOWER(p.name) = 'sales_rep'
        AND u.company_id = ?
      ORDER BY u.name ASC`,
    [user.company_id],
  )

  const companyId = user.company_id

  const [
    dealActivityCreated,
    dealActivityCompleted,
    dealNotesList,
    smsRows,
    emailActivities,
    customerPhones,
  ] = await Promise.all([
    selectMany<UserActivity>(
      db,
      `SELECT
          da.id AS id,
          'deal_activity' AS source,
          COALESCE(u_creator.id, u_deal.id) AS user_id,
          COALESCE(u_creator.name, u_deal.name) AS user_name,
          CASE
            WHEN LOWER(da.name) LIKE '%text%' THEN 'Sent a text'
            ELSE 'Add Activity'
          END AS action,
          DATE_FORMAT(da.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deal_activities da
        LEFT JOIN deals d ON d.id = da.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_creator ON u_creator.company_id = da.company_id AND u_creator.is_deleted = 0
          AND da.created_by IS NOT NULL AND da.created_by != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(da.created_by))
        LEFT JOIN users u_deal ON u_deal.id = d.user_id AND u_deal.company_id = da.company_id AND u_deal.is_deleted = 0
        WHERE da.company_id = ? AND da.deleted_at IS NULL`,
      [companyId],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          da.id AS id,
          'deal_activity_completed' AS source,
          COALESCE(u_creator.id, u_deal.id) AS user_id,
          COALESCE(u_creator.name, u_deal.name) AS user_name,
          'Complete Activity' AS action,
          DATE_FORMAT(da.completed_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deal_activities da
        LEFT JOIN deals d ON d.id = da.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_creator ON u_creator.company_id = da.company_id AND u_creator.is_deleted = 0
          AND da.created_by IS NOT NULL AND da.created_by != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(da.created_by))
        LEFT JOIN users u_deal ON u_deal.id = d.user_id AND u_deal.company_id = da.company_id AND u_deal.is_deleted = 0
        WHERE da.company_id = ?
          AND da.deleted_at IS NULL
          AND da.is_completed = 1
          AND da.completed_at IS NOT NULL`,
      [companyId],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          dn.id AS id,
          'deal_note' AS source,
          COALESCE(u_creator.id, u_deal.id) AS user_id,
          COALESCE(u_creator.name, u_deal.name) AS user_name,
          'Add Note' AS action,
          DATE_FORMAT(dn.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          cust.name AS customer_name
        FROM deal_notes dn
        LEFT JOIN deals d ON d.id = dn.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers cust ON cust.id = d.customer_id AND cust.deleted_at IS NULL
        LEFT JOIN users u_creator ON u_creator.company_id = dn.company_id AND u_creator.is_deleted = 0
          AND dn.created_by IS NOT NULL AND dn.created_by != ''
          AND LOWER(TRIM(u_creator.name)) = LOWER(TRIM(dn.created_by))
        LEFT JOIN users u_deal ON u_deal.id = d.user_id AND u_deal.company_id = dn.company_id AND u_deal.is_deleted = 0
        WHERE dn.company_id = ? AND dn.deleted_at IS NULL`,
      [companyId],
    ),
    selectMany<SmsActivityRow>(
      db,
      `SELECT
          cs.id AS id,
          'cloudtalk_sms' AS source,
          u.id AS user_id,
          u.name AS user_name,
          'Sent a text' AS action,
          DATE_FORMAT(cs.created_date, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          CAST(IFNULL(cs.sender, '') AS CHAR) AS sender,
          CAST(IFNULL(cs.recipient, '') AS CHAR) AS recipient
        FROM cloudtalk_sms cs
        JOIN users u ON u.cloudtalk_agent_id = cs.agent
        WHERE u.company_id = ? AND u.is_deleted = 0
        ORDER BY cs.created_date DESC, cs.id DESC`,
      [companyId],
    ),
    selectMany<UserActivity>(
      db,
      `SELECT
          e.id AS id,
          'email' AS source,
          e.sender_user_id AS user_id,
          u.name AS user_name,
          'Sent email' AS action,
          DATE_FORMAT(e.sent_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
          COALESCE(
            c_deal.name,
            (
              SELECT c2.name FROM customers c2
              WHERE c2.company_id = u.company_id
                AND c2.deleted_at IS NULL
                AND (
                  LOWER(TRIM(IFNULL(c2.email, ''))) = LOWER(TRIM(IFNULL(e.receiver_email, '')))
                  OR LOWER(TRIM(IFNULL(c2.email, ''))) = LOWER(TRIM(IFNULL(e.sender_email, '')))
                )
              LIMIT 1
            )
          ) AS customer_name
        FROM emails e
        JOIN users u ON u.id = e.sender_user_id
        LEFT JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL
        LEFT JOIN customers c_deal ON c_deal.id = d.customer_id AND c_deal.deleted_at IS NULL
        WHERE u.company_id = ? AND u.is_deleted = 0 AND e.deleted_at IS NULL
        ORDER BY e.sent_at DESC, e.id DESC`,
      [companyId],
    ),
    selectMany<CustomerPhoneRow>(
      db,
      `SELECT name, phone, phone_2
        FROM customers
        WHERE company_id = ? AND deleted_at IS NULL`,
      [companyId],
    ),
  ])

  const last10ToCustomerName = buildCustomerLast10NameMap(customerPhones)
  const smsActivities: UserActivity[] = smsRows.map(row => ({
    id: row.id,
    source: row.source,
    user_id: row.user_id,
    user_name: row.user_name,
    action: row.action,
    created_at: row.created_at,
    customer_name: customerNameForSmsParty(
      row.sender,
      row.recipient,
      last10ToCustomerName,
    ),
  }))

  const dealActivities = [
    ...dealActivityCreated,
    ...dealActivityCompleted,
    ...dealNotesList,
  ]

  const activities = [...dealActivities, ...smsActivities, ...emailActivities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  let callActivities: UserActivity[] = []
  try {
    const callItems: Calls200Response[] = []
    for (let page = 1; page <= 50; page += 1) {
      const callData = await fetchValue<Calls200Response>(
        'calls/index.json',
        user.company_id,
        {
          limit: 200,
          pageNumber: page,
          date_from: '2020-01-01',
        },
      )
      callItems.push(...callData.items)
      if (callData.items.length < 200) break
    }

    const userByCloudTalkAgentId: Record<string, SalesRep> = {}
    for (const rep of salesReps) {
      if (rep.cloudtalk_agent_id) {
        userByCloudTalkAgentId[rep.cloudtalk_agent_id] = rep
      }
    }

    const nextCallActivities: UserActivity[] = []
    for (const item of callItems) {
      const mappedUser = userByCloudTalkAgentId[item.Cdr.user_id]
      if (!mappedUser || !item.Cdr.started_at) continue
      const contactName = item.Contact?.name?.trim()
      nextCallActivities.push({
        id: Number(item.Cdr.id),
        source: 'cloudtalk_call',
        user_id: mappedUser.id,
        user_name: mappedUser.name,
        action: 'Made a call',
        created_at: item.Cdr.started_at,
        customer_name: contactName && contactName.length > 0 ? contactName : null,
      })
    }
    callActivities = nextCallActivities
  } catch {
    callActivities = []
  }

  return {
    salesReps,
    activities: [...activities, ...callActivities].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
  }
}

const userActivityColumns: ColumnDef<UserActivity>[] = [
  {
    accessorKey: 'created_at',
    header: 'Date',
    cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
  },
  {
    accessorKey: 'action',
    header: 'Type of activity',
  },
  {
    accessorKey: 'customer_name',
    header: 'Customer',
    cell: ({ row }) => row.original.customer_name || '-',
  },
]

export default function AdminUsersActivity() {
  const { salesReps, activities } = useLoaderData<typeof loader>()
  const [selectedUser, setSelectedUser] = useState<SalesRep | null>(null)
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfToday())
  const [dateTo, setDateTo] = useState<Date | undefined>(todayDate())
  const [genPage, setGenPage] = useState(1)
  const [genPageSize, setGenPageSize] = useState(100)
  const [genSort, setGenSort] = useState<{ key: string | null; order: 'asc' | 'desc' }>(
    {
      key: 'created_at',
      order: 'desc',
    },
  )

  const toggleGenSort = useCallback((sortKey: string) => {
    setGenSort(prev =>
      prev.key === sortKey
        ? { key: sortKey, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key: sortKey, order: 'asc' },
    )
  }, [])

  const generalActivityColumns = useMemo((): ColumnDef<UserActivity>[] => {
    return [
      {
        accessorKey: 'created_at',
        enableSorting: false,
        header: () => (
          <GeneralActivitySortHeader
            title='Date'
            sortKey='created_at'
            sort={genSort}
            onToggle={toggleGenSort}
          />
        ),
        cell: ({ row }: { row: Row<UserActivity> }) =>
          new Date(row.original.created_at).toLocaleString(),
      },
      {
        accessorKey: 'customer_name',
        enableSorting: false,
        header: () => (
          <GeneralActivitySortHeader
            title='Customer'
            sortKey='customer_name'
            sort={genSort}
            onToggle={toggleGenSort}
          />
        ),
        cell: ({ row }: { row: Row<UserActivity> }) =>
          row.original.customer_name || '-',
      },
      {
        accessorKey: 'action',
        enableSorting: false,
        header: () => (
          <GeneralActivitySortHeader
            title='Type of activity'
            sortKey='action'
            sort={genSort}
            onToggle={toggleGenSort}
          />
        ),
      },
      {
        accessorKey: 'user_name',
        enableSorting: false,
        header: () => (
          <GeneralActivitySortHeader
            title='User name'
            sortKey='user_name'
            sort={genSort}
            onToggle={toggleGenSort}
          />
        ),
        cell: ({ row }: { row: Row<UserActivity> }) => row.original.user_name || '-',
      },
    ]
  }, [genSort, toggleGenSort])

  const sortedGeneralActivities = useMemo(() => {
    const result = [...activities]
    const key = genSort.key
    const order = genSort.order
    if (!key) {
      result.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      return result
    }
    result.sort((a, b) => compareActivityRows(a, b, key, order))
    return result
  }, [activities, genSort])

  const genTotalPages = Math.max(
    1,
    Math.ceil(sortedGeneralActivities.length / genPageSize),
  )
  const genCurrentPage = Math.min(genPage, genTotalPages)
  const genStart = (genCurrentPage - 1) * genPageSize
  const generalTableRows = sortedGeneralActivities.slice(
    genStart,
    genStart + genPageSize,
  )

  const handlePreset = (preset: DatePreset) => {
    if (preset === 'all') {
      setDateFrom(undefined)
      setDateTo(undefined)
      return
    }
    if (preset === '1d') {
      setDateFrom(startOfToday())
      setDateTo(todayDate())
      return
    }
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
    setDateFrom(daysAgoDate(days))
    setDateTo(todayDate())
  }

  const selectedUserActivities = useMemo(() => {
    if (!selectedUser) return []
    return activities
      .filter(item => item.user_id === selectedUser.id)
      .filter(item => {
        const activityDate = new Date(item.created_at)
        if (dateFrom && activityDate < dateFrom) return false
        if (dateTo && activityDate > dateTo) return false
        return true
      })
  }, [activities, selectedUser, dateFrom, dateTo])

  return (
    <PageLayout title='Sales Reps Activity'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
        {salesReps.map(rep => (
          <Button
            key={rep.id}
            type='button'
            variant='outline'
            className='h-48 flex-col gap-2'
            onClick={() => setSelectedUser(rep)}
          >
            <User className='h-6 w-6' />
            <span className='truncate text-sm'>{rep.name}</span>
          </Button>
        ))}
      </div>
      <div className='mt-6'>
        <div className='mb-2 text-xl font-medium text-center'>General activity</div>
        {activities.length === 0 ? (
          <div className='text-sm text-slate-500 text-center'>No activity yet</div>
        ) : (
          <>
            <DataTablePagination
              currentPage={genCurrentPage}
              totalPages={genTotalPages}
              pageSize={genPageSize}
              totalRows={sortedGeneralActivities.length}
              onPageChange={setGenPage}
              onPageSizeChange={size => {
                setGenPageSize(size)
                setGenPage(1)
              }}
            />
            <DataTable
              key={`${genCurrentPage}-${genPageSize}-${genSort.key}-${genSort.order}`}
              columns={generalActivityColumns}
              data={generalTableRows}
              getRowId={row => `${row.source}-${row.id}`}
            />
            <DataTablePagination
              currentPage={genCurrentPage}
              totalPages={genTotalPages}
              pageSize={genPageSize}
              totalRows={sortedGeneralActivities.length}
              onPageChange={setGenPage}
              onPageSizeChange={size => {
                setGenPageSize(size)
                setGenPage(1)
              }}
            />
          </>
        )}
      </div>
      <Dialog
        open={selectedUser !== null}
        onOpenChange={open => {
          if (!open) setSelectedUser(null)
        }}
      >
        <DialogContent className='sm:max-w-[760px] max-h-[85vh] overflow-hidden'>
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? `${selectedUser.name} activity` : 'User activity'}
            </DialogTitle>
          </DialogHeader>
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRangeChange={range => {
              if (!range?.from) {
                setDateFrom(undefined)
                setDateTo(undefined)
                return
              }
              setDateFrom(startOfDay(range.from))
              setDateTo(endOfDay(range.to || range.from))
            }}
            onPreset={handlePreset}
          />
          {selectedUserActivities.length === 0 ? (
            <div className='text-sm text-slate-500'>No activity yet</div>
          ) : (
            <div className='h-[80vh] overflow-y-auto'>
              <DataTable
                key={`${selectedUser?.id || 'none'}-${dateFrom?.toISOString() || 'all'}-${dateTo?.toISOString() || 'all'}`}
                columns={userActivityColumns}
                data={selectedUserActivities}
                getRowId={row => `${row.source}-${row.id}`}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
