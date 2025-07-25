import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import {
  type ActionFunctionArgs,
  Form,
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
} from 'react-router'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { PageLayout } from '~/components/PageLayout'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

interface PayrollRule {
  id: number
  name: string
  amount: number
  type: string
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const companyId = user.company_id

    const query = `
      SELECT 
        id, 
        name,
        amount,
        type
      FROM 
        payroll
      WHERE
        company_id = ?
      ORDER BY 
        name ASC
    `

    const payrollRules = await selectMany<PayrollRule>(db, query, [companyId])

    return {
      payrollRules,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getAdminUser(request)
  if (!user || !user.company_id) {
    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Error', 'Unauthorized', 'destructive'))
    return redirect('/login', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Error', 'Invalid action', 'destructive'))
  return redirect('/admin/payroll_rules', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function AdminPayrollRules() {
  const { payrollRules } = useLoaderData<typeof loader>()
  const location = useLocation()

  const columns: ColumnDef<PayrollRule>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column} title='Rule Name' />,
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <SortableHeader column={column} title='Amount' />,
      cell: ({ row }) => {
        const value = row.original.amount
        const type = row.original.type

        if (type.toLowerCase() === 'percentage') {
          return `${value}%`
        } else {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(value)
        }
      },
    },
    {
      accessorKey: 'type',
      header: ({ column }) => <SortableHeader column={column} title='Type' />,
      cell: ({ row }) => {
        const type = row.original.type
        let displayText = type
        let colorClass = ''

        switch (type.toLowerCase()) {
          case 'percentage':
            displayText = 'Percentage'
            colorClass = 'text-blue-600'
            break
          case 'fixed':
            displayText = 'Fixed Amount'
            colorClass = 'text-green-600'
            break
          default:
            colorClass = 'text-gray-600'
        }

        return <span className={colorClass}>{displayText}</span>
      },
    },
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

  return (
    <PageLayout title='Payroll Rules'>
      <div className='mb-6 flex justify-between items-center'>
        <Link
          to='/admin/payroll_rules/add'
          className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-md hover:bg-zinc-900/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        >
          <Plus className='w-4 h-4 mr-1' />
          Add Rule
        </Link>
      </div>

      {payrollRules.length === 0 ? (
        <div className='p-8 text-center bg-gray-50 rounded-lg'>
          <p className='text-gray-600 mb-4'>
            No payroll rules have been configured yet.
          </p>
          <Link
            to='/admin/payroll_rules/add'
            className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-md hover:bg-zinc-900/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            <Plus className='w-4 h-4 mr-1' />
            Add Your First Rule
          </Link>
        </div>
      ) : (
        <DataTable columns={columns} data={payrollRules} />
      )}

      <Outlet />
    </PageLayout>
  )
}
