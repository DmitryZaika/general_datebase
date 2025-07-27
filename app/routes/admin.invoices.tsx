import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { PageLayout } from '~/components/PageLayout'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'

interface Transaction {
  id: number
  sale_date: string
  customer_name: string
  seller_name: string
  bundle: string
  cancelled_date: string | null
  installed_date: string | null
}

function formatDate(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const transactions = await selectMany<Transaction>(
    db,
    `SELECT 
        s.id,
        s.sale_date,
        c.name as customer_name,
        u.name as seller_name,
        s.cancelled_date,
        s.installed_date
      FROM 
        sales s
      JOIN 
        customers c ON s.customer_id = c.id
      JOIN 
        users u ON s.seller_id = u.id
      WHERE
        s.company_id = ? AND s.qbo_id is null
      GROUP BY
        s.id, s.sale_date, c.name, u.name
      ORDER BY 
        s.sale_date DESC`,
    [user.company_id],
  )
  return { transactions }
}

const transactionColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: 'sale_date',
    header: ({ column }) => <SortableHeader column={column} title='Date' />,
    cell: ({ row }) => formatDate(row.original.sale_date),
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'customer_name',
    header: ({ column }) => <SortableHeader column={column} title='Customer' />,
    cell: ({ row }) => row.original.customer_name,
  },
  {
    accessorKey: 'seller_name',
    header: ({ column }) => <SortableHeader column={column} title='Sold By' />,
  },
]

export default function AdminTransactions() {
  const { transactions } = useLoaderData<typeof loader>()
  const [searchTerm, _] = useState('')
  const navigate = useNavigate()

  const filteredTransactions = transactions.filter(transaction =>
    transaction.customer_name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <>
      <PageLayout title='Invoices'>
        <DataTable
          columns={transactionColumns}
          data={filteredTransactions.map(transaction => ({
            ...transaction,
            onClick: () => navigate(`${transaction.id}`),
          }))}
        />
      </PageLayout>
      <Outlet />
    </>
  )
}
