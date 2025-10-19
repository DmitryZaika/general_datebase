import { useMutation, useQuery } from '@tanstack/react-query'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { FindCustomer } from '~/components/molecules/FindCustomer'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SelectInput } from '~/components/molecules/SelectItem'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { DataTable } from '~/components/ui/data-table'
import { FormField } from '~/components/ui/form'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { db } from '~/db.server'
import { useToast } from '~/hooks/use-toast'
import type { sourceEnum } from '~/schemas/customers'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface Customer {
  id: number
  name: string
  phone: string
  email: string
  address: string
  sales_rep: number | null
  sales_rep_name: string | null
  created_date: string
  className?: string
  company_id: number
  source: (typeof sourceEnum)[number]
  invalid_lead: string | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: { company_id: number }
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const url = new URL(request.url)
  const salesRepFilter = url.searchParams.get('sales_rep')
  const includeInvalid = url.searchParams.get('show_invalid') === '1'

  const params: number[] = []
  const conditions: string[] = ['c.deleted_at IS NULL', 'c.company_id = ?']
  params.push(user.company_id)
  if (salesRepFilter) {
    conditions.push('c.sales_rep = ?')
    params.push(Number(salesRepFilter))
  }
  if (!includeInvalid) {
    conditions.push("(c.invalid_lead IS NULL OR c.invalid_lead = '')")
  }
  const where = `WHERE ${conditions.join(' AND ')}`

  const customers = await selectMany<Customer>(
    db,
    `SELECT c.id, c.name, c.email, c.phone, c.address, c.sales_rep, c.created_date, u.name AS sales_rep_name, c.company_id, c.source, c.invalid_lead
     FROM customers c
     LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
     ${where}`,
    params,
  )

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

const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'name',
    header: 'Name of customer',
    cell: ({ row }: { row: Row<Customer> }) => {
      const name = row.original.name || ''
      const short = name.length > 20 ? `${name.slice(0, 20)}...` : name
      return <span title={name}>{short}</span>
    },
  },
  {
    accessorKey: 'phone',
    header: 'Phone Number',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  // {
  //   accessorKey: 'address',
  //   header: 'Address',
  // },
  {
    accessorKey: 'sales_rep',
    header: 'Sales Rep',
    cell: ({ row }: { row: Row<Customer> }) => <SalesRepCell customer={row.original} />,
  },
  {
    accessorKey: 'created_date',
    header: 'Date',
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

function CustomerActions({ customer }: { customer: Customer }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const actions: Record<string, string> = {
    edit: `edit/${customer.id}${location.search}`,
    delete: `delete/${customer.id}${location.search}`,
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

  const [highlightCustomerId, setHighlightCustomerId] = useState<number | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  const tabParam = searchParams.get('tab') ?? 'all'
  const showInvalid = searchParams.get('show_invalid') === '1'
  const pageParam = Number(searchParams.get('page') || '1')
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const pageSize = 100

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const filtered = customers.filter((c: Customer) => {
    if (tabParam === 'leads') return c.source === 'leads'
    if (tabParam === 'walkin') return c.source === 'check-in'
    if (tabParam === 'call-in') return c.source === 'call-in'
    if (tabParam === 'all') return true
  })

  let fullDisplayed = filtered
  if (tabParam === 'leads' || tabParam === 'walkin' || tabParam === 'call-in') {
    fullDisplayed = [...filtered].sort(
      (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime(),
    )
  } else if (tabParam === 'all') {
    fullDisplayed = [...filtered].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? ''),
    )
  }

  const totalPages = Math.max(1, Math.ceil(fullDisplayed.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  let displayed = fullDisplayed.slice(startIndex, endIndex)

  displayed = displayed.map((c: Customer) => ({
    ...c,
    className: `${c.className ?? ''} customer-row-${c.id} cursor-pointer ${
      highlightCustomerId === c.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''
    }`.trim(),
    onClick: () => navigate(`info/${c.id}${location.search}`),
  }))

  useEffect(() => {
    const highlightParam = searchParams.get('highlight')
    const id = highlightParam ? Number(highlightParam) : 0
    if (!id) return
    // Delay to next paint to ensure rows are rendered
    setTimeout(() => {
      const el = document.querySelector(`.customer-row-${id}`) as HTMLElement | null
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

  return (
    <PageLayout title='Customers List'>
      <div className='flex flex-col md:flex-row items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Tabs value={tabParam} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value='all'>All Customers</TabsTrigger>
              <TabsTrigger value='walkin'>Walk-in</TabsTrigger>
              <TabsTrigger value='leads'>Leads</TabsTrigger>
              <TabsTrigger value='call-in'>Call-In</TabsTrigger>
            </TabsList>
          </Tabs>
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
      <DataTable
        key={`${tabParam}-${currentPage}`}
        columns={customerColumns}
        data={displayed}
      />
      <Outlet />
      <div className='mt-3 flex items-center justify-center gap-2'>
        <Button
          className='px-3 py-1 border rounded disabled:opacity-50'
          disabled={currentPage <= 1}
          onClick={() => {
            const params = new URLSearchParams(searchParams)
            params.set('page', String(currentPage - 1))
            navigate({ pathname: location.pathname, search: params.toString() })
          }}
        >
          Prev
        </Button>
        <span className='text-sm'>
          Page {currentPage} / {totalPages}
        </span>
        <Button
          className='px-3 py-1 border rounded disabled:opacity-50'
          disabled={currentPage >= totalPages}
          onClick={() => {
            const params = new URLSearchParams(searchParams)
            params.set('page', String(currentPage + 1))
            navigate({ pathname: location.pathname, search: params.toString() })
          }}
        >
          Next
        </Button>
      </div>
      <Outlet />
    </PageLayout>
  )
}
