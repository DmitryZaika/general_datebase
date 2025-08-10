import { useMutation, useQuery } from '@tanstack/react-query'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
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
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SelectInput } from '~/components/molecules/SelectItem'
import { PageLayout } from '~/components/PageLayout'
import { DataTable } from '~/components/ui/data-table'
import { FormField } from '~/components/ui/form'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { db } from '~/db.server'
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
  source: 'check-in' | 'user-input'
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

  const params: number[] = []
  const conditions: string[] = ['c.company_id = ?']
  params.push(user.company_id)
  if (salesRepFilter) {
    conditions.push('c.sales_rep = ?')
    params.push(Number(salesRepFilter))
  }
  const where = `WHERE ${conditions.join(' AND ')}`

  const customers = await selectMany<Customer>(
    db,
    `SELECT c.id, c.name, c.email, c.phone, c.address, c.sales_rep, c.created_date, u.name AS sales_rep_name, c.company_id, c.source
     FROM customers c
     LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
     ${where}`,
    params,
  )

  const processed = customers.map(c => ({
    ...c,
    className: c.sales_rep === null ? 'bg-red-200' : undefined,
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
    </FormProvider>
  )
}

const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'name',
    header: 'Name of customer',
  },
  {
    accessorKey: 'phone',
    header: 'Phone Number',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'address',
    header: 'Address',
  },
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
    cell: ({ row }: { row: Row<Customer> }) => {
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

export default function AdminCustomers() {
  const { customers } = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const tabParam = searchParams.get('tab') ?? 'walkin'

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', tab)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const filtered = customers.filter(c => {
    if (tabParam === 'leads') return
    if (tabParam === 'walkin') return c.source === 'check-in'
    return true
  })

  let displayed = filtered
  if (tabParam === 'leads' || tabParam === 'walkin') {
    displayed = [...filtered].sort(
      (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime(),
    )
  } else if (tabParam === 'all') {
    displayed = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <PageLayout title='Customers List'>
      <Tabs value={tabParam} onValueChange={handleTabChange} className='mb-4'>
        <TabsList>
          <TabsTrigger value='walkin'>Walk-in</TabsTrigger>
          <TabsTrigger value='leads'>Leads</TabsTrigger>
          <TabsTrigger value='all'>All Customers</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className='w-fit'>
        <Link to={`add`} relative='path' className='inline-flex w-fit'>
          <LoadingButton loading={false} className='inline-flex items-center'>
            <Plus className='w-4 h-4 mr-1' />
            Add Customer
          </LoadingButton>
        </Link>
      </div>
      <DataTable key={tabParam} columns={customerColumns} data={displayed} />
      <Outlet />
    </PageLayout>
  )
}
