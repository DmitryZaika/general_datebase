import type { ColumnDef, Row } from '@tanstack/react-table'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { Badge } from '~/components/ui/badge'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface EmailHistory {
  id: number
  thread_id: string
  subject: string
  body: string
  sent_at: string
  read_count: number
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }

  const dealId = parseInt(params.dealId, 10)

  const [emails] = await selectMany<EmailHistory[]>(
    db,
    `SELECT
      e.id,
      e.thread_id,
      e.subject,
      e.body,
      e.sent_at,
      COUNT(er.message_id) AS read_count
    FROM emails e
    LEFT JOIN email_reads er
      ON e.message_id = er.message_id
     AND er.read_at >= e.sent_at + INTERVAL 10 SECOND
    WHERE e.deleted_at IS NULL
      AND e.deal_id = ?
    GROUP BY
      e.id,
      e.thread_id,
      e.subject,
      e.body,
      e.sent_at
    ORDER BY e.sent_at DESC;`,
    [dealId],
  )

  return { emails }
}

const DateCell = ({ row }: { row: Row<EmailHistory> }) => {
  const date = new Date(row.original.sent_at)
  const cleanDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return (
    <div>
      <Badge variant='primary'>{row.original.read_count}</Badge>
      <span className='text-xs ml-2'>{cleanDate}</span>
    </div>
  )
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
  const handleRowClick = (email: EmailHistory) => {
    navigate(`chat/${email.thread_id}${location.search}`)
  }

  return (
    <>
      <DataTable
        columns={customerColumns}
        data={emails}
        onRowClick={(email: EmailHistory) => handleRowClick(email)}
        rowClassName={() => 'cursor-pointer'}
        getRowId={(email: EmailHistory) => email.thread_id}
      />
      <Outlet />
    </>
  )
}
