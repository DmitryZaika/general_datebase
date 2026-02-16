import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import DealsEmailsView, { type Email } from '~/components/views/DealsEmailsView'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user: User = await getAdminUser(request)
    const url = new URL(request.url)
    const salesRepFilter = url.searchParams.get('sales_rep')

    let query = `SELECT e.id, e.thread_id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.sender_user_id,
       (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 as has_attachments,
       COALESCE(s.name, (SELECT name FROM customers WHERE email = e.sender_email AND company_id = ? LIMIT 1)) as sender_name,
       COALESCE(r.name, (SELECT name FROM customers WHERE email = e.receiver_email AND company_id = ? LIMIT 1)) as receiver_name
       FROM emails e
       LEFT JOIN users s ON e.sender_user_id = s.id
       LEFT JOIN users r ON e.receiver_email = r.email
       WHERE e.deleted_at IS NULL AND (s.company_id = ? OR r.company_id = ?)`

    const params: (string | number)[] = [
      user.company_id || 0,
      user.company_id || 0,
      user.company_id || 0,
      user.company_id || 0,
    ]

    if (salesRepFilter) {
      query += ` AND (e.sender_user_id = ? OR r.id = ?)`
      params.push(Number(salesRepFilter), Number(salesRepFilter))
    }

    query += ` ORDER BY e.sent_at DESC LIMIT 2000`

    // Fetch all emails for admin view
    const userEmails = await selectMany<Email>(db, query, params)

    const salesReps = await selectMany<{ id: number; name: string }>(
      db,
      `SELECT u.id, u.name
       FROM users u
       JOIN users_positions up ON up.user_id = u.id
       JOIN positions p ON p.id = up.position_id
       WHERE LOWER(p.name) = 'sales_rep'
         AND u.is_deleted = 0
         AND u.company_id = ?`,
      [user.company_id || 0],
    )

    return {
      userEmails,
      userEmail: user.email,
      salesReps,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function AdminEmails() {
  const { userEmails, userEmail, salesReps } = useLoaderData<{
    userEmails: Email[]
    userEmail: string
    salesReps: { id: number; name: string }[]
  }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const salesRepParam = searchParams.get('sales_rep')

  const handleSalesRepChange = (val: string) => {
    const params = new URLSearchParams(searchParams)
    if (val === 'all') {
      params.delete('sales_rep')
    } else {
      params.set('sales_rep', val)
    }
    navigate({ search: params.toString() })
  }

  return (
    <div className='w-full h-full p-2 flex flex-col gap-4'>
      <div className='flex items-center gap-4'>
        <Select value={salesRepParam || 'all'} onValueChange={handleSalesRepChange}>
          <SelectTrigger className='w-[200px] bg-white'>
            <SelectValue placeholder='Select Sales Rep' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Sales Reps</SelectItem>
            {salesReps.map(rep => (
              <SelectItem key={rep.id} value={String(rep.id)}>
                {rep.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='flex-1 min-h-0'>
        <DealsEmailsView
          emails={userEmails}
          currentUserEmail={userEmail}
          adminMode={true}
        />
      </div>
      <Outlet />
    </div>
  )
}
