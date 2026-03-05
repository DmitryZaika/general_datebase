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

    const folderCondition = isSent ? senderCondition : receiverCondition
    const folderParams = isSent
      ? [user.id, userEmailNorm, userEmailNorm, userEmailLike]
      : [userEmailNorm, userEmailNorm, userEmailLike]

    const [inboxCountRows, sentCountRows, userEmails] = await Promise.all([
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
      selectMany<Email>(
        db,
        `SELECT e.id, e.thread_id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.sender_user_id, e.employee_read_at,
         (SELECT MAX(er.read_at) FROM email_reads er WHERE er.message_id = e.message_id) AS client_read_at,
         (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 as has_attachments,
         COALESCE(s.name, (SELECT name FROM customers WHERE email = e.sender_email LIMIT 1)) as sender_name,
         COALESCE(r.name, (SELECT name FROM customers WHERE email = e.receiver_email LIMIT 1)) as receiver_name
         FROM emails e
         LEFT JOIN users s ON e.sender_user_id = s.id
         LEFT JOIN users r ON e.receiver_email = r.email
         WHERE e.deleted_at IS NULL
         AND ${folderCondition}
         ORDER BY e.sent_at DESC
         LIMIT 2000`,
        folderParams,
      ),
    ])

    return {
      userEmails,
      userEmail: user.email,
      userId: user.id,
      folder: isSent ? 'sent' : 'inbox',
      inboxCount: inboxCountRows[0]?.c ?? 0,
      sentCount: sentCountRows[0]?.c ?? 0,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function EmployeeEmails() {
  const { userEmails, userEmail, userId, folder, inboxCount, sentCount } =
    useLoaderData<{
      userEmails: Email[]
      userEmail: string
      userId: number
      folder: 'inbox' | 'sent'
      inboxCount: number
      sentCount: number
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
      />
      <Outlet />
    </div>
  )
}
