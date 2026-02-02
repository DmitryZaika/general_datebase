import { Mail } from 'lucide-react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import DealsEmailsView, { type Email } from '~/components/views/DealsEmailsView'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user: User = await getAdminUser(request)

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

export default function AdminEmails() {
  const { userEmails, userEmail } = useLoaderData<{
    userEmails: Email[]
    userEmail: string
  }>()

  return (
    <div className='w-full h-full p-4'>
      <div className='flex items-center gap-2 mb-4'>
        <Mail className='w-6 h-6 text-gray-500' />
        <h1 className='text-2xl font-bold'>Emails</h1>
      </div>
      <DealsEmailsView emails={userEmails} currentUserEmail={userEmail} />
    </div>
  )
}
