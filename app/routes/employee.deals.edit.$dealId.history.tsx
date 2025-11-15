import type { ColumnDef } from '@tanstack/react-table'
import type { RowDataPacket } from 'mysql2'
import {
    type LoaderFunctionArgs,
    redirect,
    useLoaderData,
} from 'react-router'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

interface EmailHistory {
  id: number
  recipient_email: string
  subject: string
  original_subject: string
  body: string
  sent_at: string
  sender_name: string
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
    `SELECT e.id, e.subject, e.body, e.sent_at, u.name as sender_name
       FROM emails e
       JOIN users u ON e.user_id = u.id
      WHERE e.subject LIKE ? AND e.deleted_at IS NULL
      ORDER BY e.sent_at DESC`,
    [`[Deal #${dealId}]%`],
  )
  
  const emails: EmailHistory[] = (rows || []).map(row => {
    const subjectMatch = row.subject.match(/\[Deal #\d+\] \[To: ([^\]]+)\] (.+)/)
    const recipient = subjectMatch ? subjectMatch[1] : 'Unknown'
    const actualSubject = subjectMatch ? subjectMatch[2] : row.subject
    
    return {
      id: row.id,
      recipient_email: recipient,
      subject: actualSubject,
      original_subject: row.subject,
      body: row.body,
      sent_at: row.sent_at,
      sender_name: row.sender_name,
    }
  })
  
  return { emails }
}

export default function DealEmailHistory() {
  const { emails } = useLoaderData<typeof loader>()

  const columns: ColumnDef<EmailHistory>[] = [
    {
      header: 'Date',
      accessorKey: 'sent_at',
      cell: ({ row }) => {
        const date = new Date(row.original.sent_at)
        return date.toLocaleString()
      },
    },
    {
      header: 'To',
      accessorKey: 'recipient_email',
    },
    {
      header: 'Subject',
      accessorKey: 'subject',
    },
    {
      header: 'Body',
      accessorKey: 'body',
      cell: ({ row }) => {
        const body = row.original.body
        return (
          <div className='max-w-md truncate' title={body}>
            {body}
          </div>
        )
      },
    },
    {
      header: 'Sent By',
      accessorKey: 'sender_name',
    },
  ]

  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-bold'>Email History</h2>
      {emails.length === 0 ? (
        <p className='text-gray-500'>No emails sent yet.</p>
      ) : (
        <DataTable columns={columns} data={emails} />
      )}
    </div>
  )
}

