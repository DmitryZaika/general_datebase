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
    const isTrash = folder === 'trash'
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const pageSize = 50
    const search = (url.searchParams.get('search') || '').trim()
    const searchClause = search
      ? ` AND (e.subject LIKE ? OR e.body LIKE ? OR e.sender_email LIKE ? OR e.receiver_email LIKE ?)`
      : ''
    const searchParamsArr = search
      ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
      : []

    const companyId = user.company_id || 0
    const baseWhere = `e.deleted_at IS NULL AND (s.company_id = ? OR r.company_id = ?)`
    const baseWhereTrash = `e.deleted_at IS NOT NULL AND (s.company_id = ? OR r.company_id = ?)`
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

    const whereInbox = `${baseWhere}${salesRepClause}${folderClauseInbox}${searchClause}`
    const whereSent = `${baseWhere}${salesRepClause}${folderClauseSent}${searchClause}`
    const whereTrash = `${baseWhereTrash}${salesRepClause}${folderClauseInbox}${searchClause}`
    const subqueryWhereInbox = whereInbox
      .replaceAll('e.', 'e2.')
      .replaceAll('s.', 's2.')
      .replaceAll('r.', 'r2.')
    const subqueryWhereSent = whereSent
      .replaceAll('e.', 'e2.')
      .replaceAll('s.', 's2.')
      .replaceAll('r.', 'r2.')
    const subqueryWhereTrash = whereTrash
      .replaceAll('e.', 'e2.')
      .replaceAll('s.', 's2.')
      .replaceAll('r.', 'r2.')
    const paramsInboxWhere = [...baseParamsWhere, ...salesRepParams, ...searchParamsArr]
    const paramsSentWhere = [
      ...baseParamsWhere,
      ...salesRepParams,
      ...folderParamsSent,
      ...searchParamsArr,
    ]
    const paramsInboxSelect = [
      ...baseParamsSelect,
      ...salesRepParams,
      ...searchParamsArr,
    ]
    const paramsSentSelect = [
      ...baseParamsSelect,
      ...salesRepParams,
      ...folderParamsSent,
      ...searchParamsArr,
    ]
    const paramsTrashWhere = [...baseParamsWhere, ...salesRepParams, ...searchParamsArr]
    const paramsTrashSelect = [
      ...baseParamsSelect,
      ...salesRepParams,
      ...searchParamsArr,
    ]
    const offset = (page - 1) * pageSize

    const selectList = `SELECT e.id, e.thread_id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.sender_user_id, e.employee_read_at,
       (SELECT MAX(er.read_at) FROM email_reads er WHERE er.message_id = e.message_id) AS client_read_at,
       (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 as has_attachments,
       COALESCE(s.name, (SELECT name FROM customers WHERE email = e.sender_email AND company_id = ? LIMIT 1)) as sender_name,
       COALESCE(r.name, (SELECT name FROM customers WHERE email = e.receiver_email AND company_id = ? LIMIT 1)) as receiver_name
       FROM emails e
       LEFT JOIN users s ON e.sender_user_id = s.id
       LEFT JOIN users r ON e.receiver_email = r.email`

    const [
      inboxCountRows,
      sentCountRows,
      trashCountRows,
      totalCountRows,
      userEmails,
      salesReps,
    ] = await Promise.all([
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
      selectMany<{ c: number }>(
        db,
        `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         LEFT JOIN users s ON e.sender_user_id = s.id
         LEFT JOIN users r ON e.receiver_email = r.email
         WHERE ${whereTrash}`,
        paramsTrashWhere,
      ),
      selectMany<{ c: number }>(
        db,
        `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         LEFT JOIN users s ON e.sender_user_id = s.id
         LEFT JOIN users r ON e.receiver_email = r.email
         WHERE ${isTrash ? whereTrash : isSent ? whereSent : whereInbox}`,
        isTrash ? paramsTrashWhere : isSent ? paramsSentWhere : paramsInboxWhere,
      ),
      selectMany<Email>(
        db,
        `${selectList}
         WHERE ${isTrash ? whereTrash : isSent ? whereSent : whereInbox}
         AND e.thread_id IN (
           SELECT thread_id FROM (
             SELECT e2.thread_id, MAX(e2.sent_at) AS mt
             FROM emails e2
             LEFT JOIN users s2 ON e2.sender_user_id = s2.id
             LEFT JOIN users r2 ON e2.receiver_email = r2.email
             WHERE ${isTrash ? subqueryWhereTrash : isSent ? subqueryWhereSent : subqueryWhereInbox}
             GROUP BY e2.thread_id
             ORDER BY mt DESC
             LIMIT ${pageSize} OFFSET ${offset}
           ) t
         )
         ORDER BY e.sent_at DESC`,
        [
          ...(isTrash
            ? paramsTrashSelect
            : isSent
              ? paramsSentSelect
              : paramsInboxSelect),
          ...(isTrash ? paramsTrashWhere : isSent ? paramsSentWhere : paramsInboxWhere),
        ],
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

    const totalCount = totalCountRows[0]?.c ?? 0

    return {
      userEmails,
      userEmail: user.email,
      salesReps,
      folder: isTrash ? 'trash' : isSent ? 'sent' : 'inbox',
      inboxCount: inboxCountRows[0]?.c ?? 0,
      sentCount: sentCountRows[0]?.c ?? 0,
      trashCount: trashCountRows[0]?.c ?? 0,
      totalCount,
      currentPage: page,
      pageSize,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function AdminEmails() {
  const location = useLocation()
  const {
    userEmails,
    userEmail,
    salesReps,
    folder,
    inboxCount,
    sentCount,
    trashCount,
    totalCount,
    currentPage,
    pageSize,
  } = useLoaderData<{
    userEmails: Email[]
    userEmail: string
    salesReps: { id: number; name: string }[]
    folder: 'inbox' | 'sent' | 'trash'
    inboxCount: number
    sentCount: number
    trashCount: number
    totalCount: number
    currentPage: number
    pageSize: number
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
          trashCount={trashCount}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
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
