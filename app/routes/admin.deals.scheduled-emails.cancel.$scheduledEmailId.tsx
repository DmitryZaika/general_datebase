import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'
import { cancelScheduledEmail } from '~/crud/scheduledEmails'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

interface ScheduledEmailInfo {
  id: number
  customer_name: string
  template_name: string
  status: string
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const scheduledEmailId = parseInt(params.scheduledEmailId ?? '', 10)
  if (Number.isNaN(scheduledEmailId)) {
    return redirect('..')
  }

  const emails = await selectMany<ScheduledEmailInfo>(
    db,
    `SELECT se.id, se.status,
            c.name AS customer_name,
            et.template_name
     FROM scheduled_emails se
     JOIN customers c ON se.customer_id = c.id
     JOIN email_templates et ON se.template_id = et.id
     WHERE se.id = ? AND se.company_id = ? AND se.status = 'pending'`,
    [scheduledEmailId, user.company_id],
  )

  if (emails.length === 0) {
    return redirect('..')
  }

  return { scheduledEmail: emails[0] }
}

export async function action({ request, params }: ActionFunctionArgs) {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  const scheduledEmailId = parseInt(params.scheduledEmailId ?? '', 10)
  if (Number.isNaN(scheduledEmailId)) {
    return redirect('..')
  }

  await cancelScheduledEmail(db, scheduledEmailId, user.company_id)

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Scheduled email cancelled'))

  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function CancelScheduledEmail() {
  const { scheduledEmail } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate('..')
    }
  }

  return (
    <DeleteRow
      handleChange={handleChange}
      title='Cancel Scheduled Email'
      description={`Are you sure you want to cancel the scheduled email "${scheduledEmail.template_name}" for ${scheduledEmail.customer_name}?`}
    />
  )
}
