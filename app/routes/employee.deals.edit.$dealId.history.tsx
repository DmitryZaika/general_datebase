import type { RowDataPacket } from 'mysql2'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
} from 'react-router'
import { Button } from '~/components/ui/button'
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

export default function DealEmailHistory() {
  const { emails } = useLoaderData<typeof loader>()
  const location = useLocation()

  return (
    <>
      <div className='space-y-4'>
        <h2 className='text-xl font-bold'>Email History</h2>
        {emails.length === 0 ? (
          <p className='text-gray-500'>No emails sent yet.</p>
        ) : (
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between px-3 py-2 text-sm font-semibold text-zinc-700 border-b'>
              <span className='w-20'>Date</span>
              <span className='flex-1 max-w-[200px] text-center'>Subject</span>
              <span className='flex-1 max-w-[200px] text-right'>Body</span>
            </div>
            {emails.map(email => {
              const date = new Date(email.sent_at)
              const dateString = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })

              return (
                <Link
                  key={email.id}
                  to={`chat${location.search}`}
                  className='flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-zinc-100'
                >
                  <span className='text-zinc-600 w-20'>{dateString}</span>

                  <span className='flex-1 max-w-[200px] text-center truncate'>
                    {email.subject}
                  </span>
                  <span className='flex-1 max-w-[200px] text-right truncate'>
                    {email.body.slice(0, 50)}...
                  </span>
                </Link>
              )
            })}
            <Link className='w-full' to={`../email${location.search}`}><Button className='w-full'>Send Email</Button></Link>
          </div>
        )}
      </div>
      <Outlet />
    </>
  )
}

