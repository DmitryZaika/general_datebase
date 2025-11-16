import { ColumnDef, Row } from '@tanstack/react-table'
import type { RowDataPacket } from 'mysql2'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate
} from 'react-router'
import { Badge } from '~/components/ui/badge'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

interface EmailHistory {
  id: number

  subject: string
  body: string
  sent_at: string
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }

  const dealId = parseInt(params.dealId, 10)

  const [customerRows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name, c.email
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ?`,
    [dealId],
  )

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT e.id, e.subject, e.body, e.sent_at
       FROM emails e
      WHERE e.deleted_at IS NULL
      ORDER BY e.sent_at DESC`,
  )

  const emails: EmailHistory[] = (rows || []).map(row => ({
    id: row.id,
    subject: row.subject,
    body: row.body,
    sent_at: row.sent_at,
  }))

  return { emails }
}

const DateCell = ({ row }: { row: Row<EmailHistory> }) => {
  const date = new Date(row.original.sent_at)
  const cleanDate = date.toLocaleDateString('en-US', {
    month: 'short',
      day: 'numeric',
    })
  return <div><Badge variant='primary'>0</Badge><span className='text-xs ml-2'>{cleanDate}</span></div>
}

const customerColumns: ColumnDef<EmailHistory>[] = [
  { accessorKey: 'sent_at', header: 'Date', cell: DateCell },
  {
    accessorKey: 'subject',
    header: 'Subject',
    cell: ({ row }: { row: Row<EmailHistory> }) => {
      return row.original.subject
    },
  },

]

export default function DealEmailHistory() {
  const { emails } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()
  const handleRowClick = (emailId: number) => {
    navigate(`chat/${location.search}`)
  }

  return (
    <>
          <DataTable columns={customerColumns} data={emails} onRowClick={(email: EmailHistory) => handleRowClick(email.id)} rowClassName={(email: EmailHistory) => 'cursor-pointer'} />
      <Outlet />
    </>
  )
}

