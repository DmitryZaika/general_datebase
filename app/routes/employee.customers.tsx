import { useMutation, useQuery } from '@tanstack/react-query'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { CopyText } from '~/components/atoms/CopyText'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { FindCustomer } from '~/components/molecules/FindCustomer'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SelectInput } from '~/components/molecules/SelectItem'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { DataTable } from '~/components/ui/data-table'
import { FormField } from '~/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { db } from '~/db.server'
import { useToast } from '~/hooks/use-toast'
import type { sourceEnum } from '~/schemas/customers'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface Customer {
  id: number
  name: string
  phone: string
  phone_2?: string | null
  email: string
  address: string
  sales_rep: number | null
  sales_rep_name: string | null
  created_date: string
  className?: string
  company_id: number
  source: (typeof sourceEnum)[number] | 'user-input'
  invalid_lead: string | null
  revenue_generated?: number | null
  projects_count?: number | null
  company_name?: string | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: { id: number; company_id: number; is_admin: boolean }
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const url = new URL(request.url)
  const salesRepFilter = url.searchParams.get('sales_rep')
  const includeInvalid = url.searchParams.get('show_invalid') === '1'
  const view = url.searchParams.get('view') || 'customers'

  const params: number[] = []
  const conditions: string[] = ['c.deleted_at IS NULL', 'c.company_id = ?']
  params.push(user.company_id)

  if (view === 'companies') {
    conditions.push("(c.company_name IS NOT NULL AND c.company_name != '')")
  }

  if (salesRepFilter) {
    conditions.push('c.sales_rep = ?')
    params.push(Number(salesRepFilter))
  }
  if (!includeInvalid && view !== 'companies') {
    conditions.push("(c.invalid_lead IS NULL OR c.invalid_lead = '')")
  }
  const where = `WHERE ${conditions.join(' AND ')}`

  let query = `
    SELECT c.id, c.name, c.email, c.phone, c.phone_2, c.address, c.sales_rep, c.created_date, u.name AS sales_rep_name, c.company_id, c.source, c.invalid_lead, c.company_name
    FROM customers c
    LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
    ${where}
  `

  if (view === 'companies') {
    query = `
      SELECT 
        c.id, c.name, c.email, c.phone, c.phone_2, c.address, c.sales_rep, c.created_date, 
        u.name AS sales_rep_name, c.company_id, c.source, c.invalid_lead, c.company_name,
        (
          SELECT SUM(s.price)
          FROM sales s
          LEFT JOIN customers sub ON sub.id = s.customer_id
          WHERE s.customer_id = c.id OR sub.parent_id = c.id
        ) as revenue_generated,
        (
          SELECT COUNT(*)
          FROM deals d
          LEFT JOIN customers sub ON sub.id = d.customer_id
          WHERE d.customer_id = c.id OR sub.parent_id = c.id
        ) as projects_count
      FROM customers c
      LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
      ${where}
    `
  }

  const customers = await selectMany<Customer>(db, query, params)

  const positions = await selectMany<{ name: string }>(
    db,
    `SELECT p.name
       FROM users_positions up
       JOIN positions p ON p.id = up.position_id
      WHERE up.user_id = ? AND up.company_id = ?`,
    [user.id, user.company_id],
  )

  const isSalesManager = positions.some(role => role.name === 'sales_manager')

  const processed = customers.map(c => ({
    ...c,
    className:
      c.sales_rep === null
        ? c.invalid_lead && c.invalid_lead !== ''
          ? 'bg-yellow-100'
          : 'bg-red-200'
        : undefined,
  }))
  return {
    customers: processed,
    isAdmin: user.is_admin,
    isSalesManager,
  }
}

function SalesRepCell({ customer }: { customer: Customer }) {
  const { data: reps = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['sales-reps'],
    queryFn: async () => {
      const res = await fetch('/api/sales-reps')
      const json = await res.json()
      return json.users ?? []
    },
  })

  const options = reps.map(r => ({ key: r.id, value: r.name }))

  const form = useForm<{ rep: string }>({
    defaultValues: {
      rep: customer.sales_rep ? String(customer.sales_rep) : '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (newRep: string) => {
      const body = {
        customer_id: customer.id,
        sales_rep: newRep ? Number(newRep) : null,
      }

      await fetch('/api/customers/set-sales-rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      window.location.reload()
    },
  })

  return (
    <FormProvider {...form}>
      <div
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <FormField
          control={form.control}
          name='rep'
          render={({ field }) => (
            <SelectInput
              name=''
              placeholder='Select'
              options={options}
              field={{
                ...field,
                onChange: val => {
                  field.onChange(val)
                  mutation.mutate(val)
                },
              }}
            />
          )}
        />
      </div>
    </FormProvider>
  )
}

function SortableHeader({ title, sortKey }: { title: string; sortKey: string }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const currentSortBy = searchParams.get('sortBy')
  const currentOrder = searchParams.get('order') || 'asc'
  const isSorted = currentSortBy === sortKey

  const toggleSort = () => {
    const params = new URLSearchParams(searchParams)
    if (isSorted) {
      params.set('order', currentOrder === 'asc' ? 'desc' : 'asc')
    } else {
      params.set('sortBy', sortKey)
      params.set('order', 'asc')
    }
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  return (
    <Button
      variant='ghost'
      onClick={toggleSort}
      className='-ml-3 h-8 p-0 px-2 font-medium hover:bg-slate-100'
    >
      {title}
      {isSorted ? (
        currentOrder === 'asc' ? (
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

const customerColumnsBase: ColumnDef<Customer>[] = [
  {
    accessorKey: 'name',
    header: () => <SortableHeader title='Name of customer' sortKey='name' />,
    cell: ({ row }: { row: Row<Customer> }) => {
      const name = row.original.name || ''
      const short = name.length > 20 ? `${name.slice(0, 20)}...` : name
      return <CopyText value={name} display={short} title={name} />
    },
  },
  {
    accessorKey: 'phone',
    header: () => <SortableHeader title='Phone Number' sortKey='phone' />,
    cell: ({ row }: { row: Row<Customer> }) => (
      <div className='flex flex-col gap-1'>
        <CopyText value={row.original.phone} title={row.original.phone} />
        {row.original.phone_2 && (
          <CopyText value={row.original.phone_2} title={row.original.phone_2} />
        )}
      </div>
    ),
  },
  {
    accessorKey: 'email',
    header: () => <SortableHeader title='Email' sortKey='email' />,
    cell: ({ row }: { row: Row<Customer> }) => (
      <CopyText value={row.original.email} title={row.original.email} />
    ),
  },
  {
    accessorKey: 'sales_rep',
    header: () => <SortableHeader title='Sales Rep' sortKey='sales_rep_name' />,
    cell: ({ row }: { row: Row<Customer> }) => <SalesRepCell customer={row.original} />,
  },
  {
    accessorKey: 'created_date',
    header: () => <SortableHeader title='Date' sortKey='created_date' />,
    cell: ({ row }: { row: Row<Customer> }) => {
      const d = new Date(row.original.created_date)
      return d.toLocaleDateString()
    },
  },
  {
    id: 'actions',
    cell: ({ row }: { row: Row<Customer> }) => (
      <CustomerActions customer={row.original} />
    ),
  },
]

import { DataTablePagination } from '~/components/ui/data-table-pagination'

function CustomerActions({ customer }: { customer: Customer }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { isSalesManager } = useLoaderData<{ isSalesManager: boolean }>()
  const actions: Record<string, string> = {
    edit: `edit/${customer.id}${location.search}`,
    ...(isSalesManager ? { delete: `delete/${customer.id}${location.search}` } : {}),
    invalid: `invalid/${customer.id}${location.search}`,
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <ActionDropdown
        actions={actions}
        onItemClick={(action, link, e) => {
          if (action !== 'delete') return
          e.preventDefault()
          e.stopPropagation()
          ;(async () => {
            const res = await fetch(`/api/deals/count-by-customer/${customer.id}`)
            if (res.ok) {
              const json = await res.json()
              if ((json.count ?? 0) > 0) {
                toast({
                  title: 'Action required',
                  description: 'Delete all related deals with this customer.',
                  duration: 7000,
                  variant: 'destructive',
                })
                return
              }
            }

            navigate(link)
          })()
          return false
        }}
      />
    </div>
  )
}

export default function AdminCustomers() {
  const { customers } = useLoaderData<{ customers: Customer[] }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const { data: reps = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['sales-reps'],
    queryFn: async () => {
      const res = await fetch('/api/sales-reps')
      const json = await res.json()
      return json.users ?? []
    },
  })

  const [highlightCustomerId, setHighlightCustomerId] = useState<number | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  const tabParam = searchParams.get('tab') ?? 'all'
  const salesRepParam = searchParams.get('sales_rep')
  const showInvalid = searchParams.get('show_invalid') === '1'
  const pageParam = Number(searchParams.get('page') || '1')
  const pageSizeParam = Number(searchParams.get('pageSize') || '100')
  const pageSize =
    Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 100
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const viewParam = searchParams.get('view') || 'customers'

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const handleSalesRepChange = (val: string) => {
    const params = new URLSearchParams(searchParams)
    if (val === 'all') {
      params.delete('sales_rep')
    } else {
      params.set('sales_rep', val)
    }
    params.set('page', '1')
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const handleViewChange = (val: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', val)
    // Reset page when switching views
    params.set('page', '1')
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const columns = useMemo(() => {
    if (viewParam !== 'companies') return customerColumnsBase

    const currency = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })

    const newCols = customerColumnsBase.filter(col =>
      'accessorKey' in col ? col.accessorKey !== 'email' : true,
    )

    newCols[0] = {
      accessorKey: 'company_name',
      header: () => <SortableHeader title='Name of Company' sortKey='company_name' />,
      cell: ({ row }: { row: Row<Customer> }) => {
        const name = row.original.company_name || row.original.name || ''
        const short = name.length > 20 ? `${name.slice(0, 20)}...` : name
        return <CopyText value={name} display={short} title={name} />
      },
    }

    const extraCols: ColumnDef<Customer>[] = [
      {
        accessorKey: 'revenue_generated',
        header: () => (
          <SortableHeader title='Revenue Generated' sortKey='revenue_generated' />
        ),
        cell: ({ row }) => {
          const val = row.original.revenue_generated
          return (
            <div className='font-medium text-emerald-600'>
              {val ? currency.format(val) : '-'}
            </div>
          )
        },
      },
      {
        accessorKey: 'projects_count',
        header: () => (
          <SortableHeader title='Amount of projects' sortKey='projects_count' />
        ),
        cell: ({ row }) => {
          const val = row.original.projects_count
          return <div className='font-medium'>{val || 0}</div>
        },
      },
    ]

    newCols.splice(2, 0, ...extraCols)
    return newCols
  }, [viewParam])

  const sortByParam = searchParams.get('sortBy')
  const orderParam = searchParams.get('order') || 'asc'

  const filtered = customers.filter((c: Customer) => {
    if (tabParam === 'leads') return c.source === 'leads'
    if (tabParam === 'walkin') return c.source === 'check-in'
    if (tabParam === 'call-in') return c.source === 'call-in'
    if (tabParam === 'other') return c.source === 'other' || c.source === 'user-input'
    if (tabParam === 'all') return true
  })

  const fullDisplayed = useMemo(() => {
    const result = [...filtered]

    if (sortByParam) {
      result.sort((a, b) => {
        const key = sortByParam as keyof Customer

        const aVal = String(a[key] ?? '').toLowerCase()
        const bVal = String(b[key] ?? '').toLowerCase()

        // Force numeric sort for specific columns or if both are numbers
        if (
          sortByParam === 'revenue_generated' ||
          sortByParam === 'projects_count' ||
          (typeof aVal === 'number' && typeof bVal === 'number')
        ) {
          const aNum = Number(aVal) || 0
          const bNum = Number(bVal) || 0
          return orderParam === 'asc' ? aNum - bNum : bNum - aNum
        }

        const aString = String(aVal || '').toLowerCase()
        const bString = String(bVal || '').toLowerCase()

        if (aString < bString) return orderParam === 'asc' ? -1 : 1
        if (aString > bString) return orderParam === 'asc' ? 1 : -1
        return 0
      })
    } else {
      if (
        tabParam === 'leads' ||
        tabParam === 'walkin' ||
        tabParam === 'call-in' ||
        tabParam === 'other'
      ) {
        result.sort(
          (a, b) =>
            new Date(b.created_date).getTime() - new Date(a.created_date).getTime(),
        )
      } else if (tabParam === 'all') {
        result.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      }
    }
    return result
  }, [filtered, sortByParam, orderParam, tabParam])

  const totalPages = Math.max(1, Math.ceil(fullDisplayed.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const displayed = fullDisplayed.slice(startIndex, endIndex)
  const rows = displayed.map((c: Customer) => ({
    ...c,
    className: `${c.className ?? ''} customer-row-${c.id} cursor-pointer ${
      highlightCustomerId === c.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''
    }`.trim(),
  }))

  useEffect(() => {
    const highlightParam = searchParams.get('highlight')
    const id = highlightParam ? Number(highlightParam) : 0
    if (!id) return
    // Delay to next paint to ensure rows are rendered
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`.customer-row-${id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightCustomerId(id)
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightCustomerId(null)
          highlightTimeoutRef.current = null
        }, 2000)
      }
      // Clean highlight param from URL so it doesn't trigger after refresh
      const params = new URLSearchParams(searchParams)
      params.delete('highlight')
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true },
      )
    }, 50)
  }, [searchParams, navigate, location.pathname])

  const handleRowClick = (customer: Customer) => {
    navigate(`info/${customer.id}${location.search}`)
  }

  const getRowClassName = (customer: Customer) => customer.className ?? ''

  return (
    <PageLayout title='Customers List'>
      <div className='flex flex-col md:flex-row items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Select value={viewParam} onValueChange={handleViewChange}>
            <SelectTrigger className='w-[180px] bg-white'>
              <SelectValue placeholder='Select view' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='customers'>Customers</SelectItem>
              <SelectItem value='companies'>Companies</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tabParam} onValueChange={handleTabChange}>
            <SelectTrigger className='w-[180px] bg-white'>
              <SelectValue placeholder='Select Type' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Customers</SelectItem>
              <SelectItem value='walkin'>Walk-in</SelectItem>
              <SelectItem value='leads'>Leads</SelectItem>
              <SelectItem value='call-in'>Call-In</SelectItem>
            </SelectContent>
          </Select>

          <Select value={salesRepParam || 'all'} onValueChange={handleSalesRepChange}>
            <SelectTrigger className='w-[180px] bg-white'>
              <SelectValue placeholder='Select Sales Rep' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Sales Reps</SelectItem>
              {reps.map(rep => (
                <SelectItem key={rep.id} value={String(rep.id)}>
                  {rep.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {tabParam === 'leads' && (
            <div className='ml-4 flex items-center gap-2 cursor-pointer'>
              <Checkbox
                id='show_invalid'
                checked={showInvalid}
                onCheckedChange={v => {
                  const params = new URLSearchParams(searchParams)
                  if (v) params.set('show_invalid', '1')
                  else params.delete('show_invalid')
                  navigate({ pathname: location.pathname, search: params.toString() })
                }}
              />
              <label htmlFor='show_invalid' className='text-sm cursor-pointer'>
                Invalid leads
              </label>
            </div>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <FindCustomer
            onSelect={customerId => {
              const index = fullDisplayed.findIndex(c => c.id === customerId)
              const targetPage = index >= 0 ? Math.floor(index / pageSize) + 1 : 1
              const params = new URLSearchParams(searchParams)
              params.set('page', String(targetPage))
              params.set('highlight', String(customerId))
              navigate({ pathname: location.pathname, search: params.toString() })
            }}
          />
        </div>
      </div>
      <div className='w-fit'>
        {tabParam === 'all' && (
          <Link
            to={`add${location.search}`}
            relative='path'
            className='inline-flex w-fit'
          >
            <LoadingButton loading={false} className='inline-flex items-center'>
              <Plus className='w-4 h-4 mr-1' />
              Add Customer
            </LoadingButton>
          </Link>
        )}
      </div>
      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRows={fullDisplayed.length}
        onPageChange={p => {
          const params = new URLSearchParams(searchParams)
          params.set('page', String(p))
          navigate({ pathname: location.pathname, search: params.toString() })
        }}
        onPageSizeChange={s => {
          const params = new URLSearchParams(searchParams)
          params.set('pageSize', String(s))
          params.set('page', '1')
          navigate({ pathname: location.pathname, search: params.toString() })
        }}
      />
      <DataTable
        key={`${tabParam}-${currentPage}-${viewParam}-${pageSize}`}
        columns={columns}
        data={rows}
        rowClassName={getRowClassName}
        onRowClick={handleRowClick}
      />
      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRows={fullDisplayed.length}
        onPageChange={p => {
          const params = new URLSearchParams(searchParams)
          params.set('page', String(p))
          navigate({ pathname: location.pathname, search: params.toString() })
        }}
        onPageSizeChange={s => {
          const params = new URLSearchParams(searchParams)
          params.set('pageSize', String(s))
          params.set('page', '1')
          navigate({ pathname: location.pathname, search: params.toString() })
        }}
      />
      <Outlet />
    </PageLayout>
  )
}
