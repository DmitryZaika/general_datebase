import { ColumnDef } from "@tanstack/react-table"
import { Plus } from 'lucide-react'
import { Link, Outlet, redirect, useLoaderData, type LoaderFunctionArgs } from "react-router"
import { PageLayout } from "~/components/PageLayout"
import { Button } from "~/components/ui/button"
import { DataTable } from "~/components/ui/data-table"
import { db } from "~/db.server"
import { selectMany } from "~/utils/queryHelpers"
import { getEmployeeUser } from "~/utils/session.server"


export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)
    const rows = await selectMany<Quote>(
      db,
      `SELECT id, quote_name, quote_type, DATE_FORMAT(created_date, '%Y-%m-%dT%H:%i:%sZ') as created_date, sales_rep
       FROM quotes
       WHERE company_id = ? AND deleted_at IS NULL
       ORDER BY created_date DESC`,
      [user.company_id],
    )
    return { quotes: rows }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

const quoteColumns: ColumnDef<Quote>[] = [
    {
        accessorKey: 'quote_name',
        header: 'Name',
    },
    {
        accessorKey: 'sales_rep',
        header: 'Sales person',
    },
    {
        accessorKey: 'quote_type',
        header: 'Quote type',
    },
    {
        accessorKey: 'created_date',
        header: 'Created date',
    },
]

interface Quote {
    id: number
    quote_name: string
    quote_type: string
    created_date: string
    sales_rep: string
}

export default function EmployeeQuotes() {
  const { quotes } = useLoaderData<typeof loader>()
  return (
    <PageLayout title='Quotes'>
         <Link to="add" className='mr-auto'>
            <Button>
              <Plus className='w-4 h-4 mr-1' />
              Add Quote
            </Button>
          </Link>
        <DataTable columns={quoteColumns} data={quotes} />
        <Outlet />
    </PageLayout>
  )
}