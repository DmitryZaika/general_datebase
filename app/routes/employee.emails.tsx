import { type LoaderFunctionArgs, Outlet, redirect, useLoaderData } from 'react-router'
import DealsEmailsView, { type Email } from '~/components/views/DealsEmailsView'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user: User = await getEmployeeUser(request)

    // Fetch emails where the user is sender or receiver
    const userEmails = await selectMany<Email>(
      db,
      `SELECT e.id, e.thread_id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.sender_user_id,
       (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 as has_attachments
       FROM emails e
       WHERE e.deleted_at IS NULL 
       AND (e.sender_email = ? OR e.receiver_email = ?)
       ORDER BY e.sent_at DESC
       LIMIT 500`,
      [user.email, user.email],
    )

    return {
      userEmails,
      userEmail: user.email,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function EmployeeEmails() {
  const { userEmails, userEmail } = useLoaderData<{
    userEmails: Email[]
    userEmail: string
  }>()

  return (
    <div className='w-full h-full p-2'>
      <DealsEmailsView emails={userEmails} currentUserEmail={userEmail} />
      <Outlet />
    </div>
  )
}
