import type { ColumnDef, Row } from '@tanstack/react-table'
import type { RowDataPacket } from 'mysql2'
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
import { getEmployeeUser } from '~/utils/session.server'

interface EmailHistory {
  id: number
  thread_id: string
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

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT e.id, e.thread_id, e.subject, e.body, e.sent_at
       FROM emails e
      WHERE e.deleted_at IS NULL AND e.deal_id = ?
      ORDER BY e.sent_at DESC`,
    [dealId],
  )

  const [readCounts] = await db.execute<RowDataPacket[]>(
    `SELECT e.id, COUNT(*) AS count
       FROM emails e
       JOIN email_reads er ON e.message_id = er.message_id
      WHERE e.deleted_at IS NULL AND e.deal_id = ?
      GROUP BY e.id`,
    [dealId],
  )

  const seenThreads = new Set<string>()
  const emails: EmailHistory[] = []
  for (const row of rows || []) {
    if (seenThreads.has(row.thread_id)) {
      continue
    }
    seenThreads.add(row.thread_id)
    emails.push({
      id: row.id,
      thread_id: row.thread_id,
      subject: row.subject,
      body: row.body,
      sent_at: row.sent_at,
    })
  }

  return { emails, readCounts }
}

const DateCell = ({ row }: { row: Row<EmailHistory> }) => {
  const { readCounts } = useLoaderData<typeof loader>()
  const date = new Date(row.original.sent_at)
  const cleanDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return (
    <div>
      <Badge variant='primary'>
        {readCounts?.find((count: RowDataPacket) => count.id === row.original.id)
          ?.count ?? 0}
      </Badge>
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
    navigate(`chat/${email.thread_id}`)
  }

  return (
    <>
      <DataTable
        columns={customerColumns}
        data={emails}
        onRowClick={(email: EmailHistory) => handleRowClick(email)}
        rowClassName={(email: EmailHistory) => 'cursor-pointer'}
        getRowId={(email: EmailHistory) => email.thread_id}
      />
      <Outlet />
    </>
  )
}
