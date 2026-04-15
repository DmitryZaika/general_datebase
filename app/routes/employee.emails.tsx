import { type LoaderFunctionArgs, Outlet, redirect, useLoaderData } from 'react-router'
import DealsEmailsView, { type Email } from '~/components/views/DealsEmailsView'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user: User = await getEmployeeUser(request)
    const userEmailNorm = (user.email || '').trim().toLowerCase()
    const userEmailLike = `%<${userEmailNorm}>`

    const url = new URL(request.url)
    const folder = url.searchParams.get('folder')
    const isSent = folder === 'sent'
    const isTrash = folder === 'trash'
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const pageSize = 50
    const search = (url.searchParams.get('search') || '').trim()
    const searchClause = search
      ? ` AND (e.subject LIKE ? OR e.body LIKE ? OR e.sender_email LIKE ? OR e.receiver_email LIKE ? OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.company_id = ?
      AND c.deleted_at IS NULL
      AND c.name LIKE ?
      AND (
        c.email = e.sender_email
        OR LOWER(TRIM(c.email)) = LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.sender_email, '<', -1), '>', 1)))
        OR (e.sender_email NOT LIKE '%<%' AND LOWER(TRIM(c.email)) = LOWER(TRIM(e.sender_email)))
      )
    ) OR EXISTS (
      SELECT 1 FROM customers c2
      WHERE c2.company_id = ?
      AND c2.deleted_at IS NULL
      AND c2.name LIKE ?
      AND (
        c2.email = e.receiver_email
        OR LOWER(TRIM(c2.email)) = LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1)))
        OR (e.receiver_email NOT LIKE '%<%' AND LOWER(TRIM(c2.email)) = LOWER(TRIM(e.receiver_email)))
      )
    ))`
      : ''
    const searchParams = search
      ? [
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          user.company_id,
          `%${search}%`,
          user.company_id,
          `%${search}%`,
        ]
      : []

    const senderCondition = `(
      e.sender_user_id = ?
      OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.sender_email, '<', -1), '>', 1))) = ?
      OR (e.sender_email NOT LIKE '%<%' AND LOWER(TRIM(e.sender_email)) = ?)
      OR e.sender_email LIKE ?
    )`
    const receiverCondition = `(
      LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1))) = ?
      OR (e.receiver_email NOT LIKE '%<%' AND LOWER(TRIM(e.receiver_email)) = ?)
      OR e.receiver_email LIKE ?
    )`

    const folderCondition = isTrash
      ? receiverCondition
      : isSent
        ? senderCondition
        : receiverCondition
    const folderParams = isTrash
      ? [userEmailNorm, userEmailNorm, userEmailLike]
      : isSent
        ? [user.id, userEmailNorm, userEmailNorm, userEmailLike]
        : [userEmailNorm, userEmailNorm, userEmailLike]

    const deletedClause = isTrash ? 'e.deleted_at IS NOT NULL' : 'e.deleted_at IS NULL'
    const folderWhere = `${deletedClause} AND ${folderCondition}`
    const whereThreadMatch = `${folderWhere}${searchClause}`
    const subqueryWhereBase = whereThreadMatch.replaceAll('e.', 'e2.')
    const paramsThreadMatch = [...folderParams, ...searchParams]
    const paramsListQuery = [...folderParams, ...paramsThreadMatch]
    const offset = (page - 1) * pageSize

    const [inboxCountRows, sentCountRows, trashCountRows, totalCountRows, userEmails] =
      await Promise.all([
        selectMany<{ c: number }>(
          db,
          `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         WHERE e.deleted_at IS NULL AND ${receiverCondition}`,
          [userEmailNorm, userEmailNorm, userEmailLike],
        ),
        selectMany<{ c: number }>(
          db,
          `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         WHERE e.deleted_at IS NULL AND ${senderCondition}`,
          [user.id, userEmailNorm, userEmailNorm, userEmailLike],
        ),
        selectMany<{ c: number }>(
          db,
          `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         WHERE e.deleted_at IS NOT NULL AND ${receiverCondition}`,
          [userEmailNorm, userEmailNorm, userEmailLike],
        ),
        selectMany<{ c: number }>(
          db,
          `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         WHERE ${whereThreadMatch}`,
          paramsThreadMatch,
        ),
        selectMany<Email>(
          db,
          `SELECT e.id, e.thread_id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.sender_user_id, e.employee_read_at,
         (SELECT MAX(er.read_at) FROM email_reads er WHERE er.message_id = e.message_id) AS client_read_at,
         (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 as has_attachments,
         EXISTS (SELECT 1 FROM email_attachments ea2 INNER JOIN emails e3 ON ea2.email_id = e3.id WHERE e3.thread_id = e.thread_id) AS thread_has_attachments,
         COALESCE(s.name, (SELECT name FROM customers WHERE email = e.sender_email LIMIT 1)) as sender_name,
         COALESCE(r.name, (SELECT name FROM customers WHERE email = e.receiver_email LIMIT 1)) as receiver_name
         FROM emails e
         LEFT JOIN users s ON e.sender_user_id = s.id
         LEFT JOIN users r ON e.receiver_email = r.email
         WHERE ${folderWhere}
         AND e.thread_id IN (
           SELECT thread_id FROM (
             SELECT e2.thread_id, MAX(e2.sent_at) AS mt
             FROM emails e2
             WHERE ${subqueryWhereBase}
             GROUP BY e2.thread_id
             ORDER BY mt DESC
             LIMIT ${pageSize} OFFSET ${offset}
           ) t
         )
         ORDER BY e.sent_at DESC`,
          paramsListQuery,
        ),
      ])

    const totalCount = totalCountRows[0]?.c ?? 0

    return {
      userEmails,
      userEmail: user.email,
      userId: user.id,
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

export default function EmployeeEmails() {
  const {
    userEmails,
    userEmail,
    userId,
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
    userId: number
    folder: 'inbox' | 'sent' | 'trash'
    inboxCount: number
    sentCount: number
    trashCount: number
    totalCount: number
    currentPage: number
    pageSize: number
  }>()

  return (
    <div className='w-full h-full p-2'>
      <DealsEmailsView
        emails={userEmails}
        currentUserEmail={userEmail}
        currentUserId={userId}
        initialFolder={folder}
        inboxCount={inboxCount}
        sentCount={sentCount}
        trashCount={trashCount}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
      />
      <Outlet />
    </div>
  )
}
