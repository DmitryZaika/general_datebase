import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
} from 'react-router'
import DealsEmailsView, { type Email } from '~/components/views/DealsEmailsView'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user: User = await getAdminUser(request)
    const url = new URL(request.url)
    const salesRepFilter = url.searchParams.get('sales_rep')
    const folder = url.searchParams.get('folder')
    const isSent = folder === 'sent'

    const companyId = user.company_id || 0
    const baseWhere = `e.deleted_at IS NULL AND (s.company_id = ? OR r.company_id = ?)`
    const baseParamsWhere: (string | number)[] = [companyId, companyId]
    const baseParamsSelect: (string | number)[] = [
      companyId,
      companyId,
      companyId,
      companyId,
    ]

    const salesRepClause = salesRepFilter
      ? ` AND (e.sender_user_id = ? OR r.id = ?)`
      : ''
    const salesRepParams = salesRepFilter
      ? [Number(salesRepFilter), Number(salesRepFilter)]
      : []

    const folderClauseInbox = ` AND e.sender_user_id IS NULL`
    const folderClauseSent = salesRepFilter
      ? ` AND e.sender_user_id IS NOT NULL AND e.sender_user_id = ?`
      : ` AND e.sender_user_id IS NOT NULL`
    const folderParamsSent = salesRepFilter ? [Number(salesRepFilter)] : []

    const whereInbox = `${baseWhere}${salesRepClause}${folderClauseInbox}`
    const whereSent = `${baseWhere}${salesRepClause}${folderClauseSent}`
    const paramsInboxWhere = [...baseParamsWhere, ...salesRepParams]
    const paramsSentWhere = [...baseParamsWhere, ...salesRepParams, ...folderParamsSent]
    const paramsInboxSelect = [...baseParamsSelect, ...salesRepParams]
    const paramsSentSelect = [
      ...baseParamsSelect,
      ...salesRepParams,
      ...folderParamsSent,
    ]

    const selectList = `SELECT e.id, e.thread_id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.sender_user_id, e.employee_read_at,
       (SELECT MAX(er.read_at) FROM email_reads er WHERE er.message_id = e.message_id) AS client_read_at,
       (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 as has_attachments,
       COALESCE(s.name, (SELECT name FROM customers WHERE email = e.sender_email AND company_id = ? LIMIT 1)) as sender_name,
       COALESCE(r.name, (SELECT name FROM customers WHERE email = e.receiver_email AND company_id = ? LIMIT 1)) as receiver_name
       FROM emails e
       LEFT JOIN users s ON e.sender_user_id = s.id
       LEFT JOIN users r ON e.receiver_email = r.email
       WHERE `

    const [inboxCountRows, sentCountRows, userEmails, salesReps] = await Promise.all([
      selectMany<{ c: number }>(
        db,
        `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         LEFT JOIN users s ON e.sender_user_id = s.id
         LEFT JOIN users r ON e.receiver_email = r.email
         WHERE ${whereInbox}`,
        paramsInboxWhere,
      ),
      selectMany<{ c: number }>(
        db,
        `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         LEFT JOIN users s ON e.sender_user_id = s.id
         LEFT JOIN users r ON e.receiver_email = r.email
         WHERE ${whereSent}`,
        paramsSentWhere,
      ),
      selectMany<Email>(
        db,
        `${selectList}${isSent ? whereSent : whereInbox} ORDER BY e.sent_at DESC LIMIT 2000`,
        isSent ? paramsSentSelect : paramsInboxSelect,
      ),
      selectMany<{ id: number; name: string }>(
        db,
        `SELECT u.id, u.name
         FROM users u
         JOIN users_positions up ON up.user_id = u.id
         JOIN positions p ON p.id = up.position_id
         WHERE LOWER(p.name) = 'sales_rep'
           AND u.is_deleted = 0
           AND u.company_id = ?`,
        [companyId],
      ),
    ])

    return {
      userEmails,
      userEmail: user.email,
      salesReps,
      folder: isSent ? 'sent' : 'inbox',
      inboxCount: inboxCountRows[0]?.c ?? 0,
      sentCount: sentCountRows[0]?.c ?? 0,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function AdminEmails() {
  const location = useLocation()
  const { userEmails, userEmail, salesReps, folder, inboxCount, sentCount } =
    useLoaderData<{
      userEmails: Email[]
      userEmail: string
      salesReps: { id: number; name: string }[]
      folder: 'inbox' | 'sent'
      inboxCount: number
      sentCount: number
    }>()
  const isChatOpen = location.pathname.includes('/chat/')

  return (
    <div className='w-full h-full p-2 flex flex-col gap-4 relative'>
      <div className={`flex-1 min-h-0 ${isChatOpen ? 'pointer-events-none' : ''}`}>
        <DealsEmailsView
          emails={userEmails}
          currentUserEmail={userEmail}
          adminMode={true}
          salesReps={salesReps}
          initialFolder={folder}
          inboxCount={inboxCount}
          sentCount={sentCount}
        />
      </div>
      {isChatOpen ? (
        <div className='fixed inset-0 z-50'>
          <Outlet />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  )
}
