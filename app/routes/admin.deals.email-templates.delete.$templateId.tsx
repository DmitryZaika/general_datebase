import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { DeleteRow } from '~/components/pages/DeleteRow'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

interface EmailTemplate {
  id: number
  template_name: string
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const templateId = parseInt(params.templateId ?? '', 10)
  if (Number.isNaN(templateId)) {
    return redirect('..')
  }

  const user: User = await getAdminUser(request)

  const templates = await selectMany<EmailTemplate>(
    db,
    `SELECT id, template_name
     FROM email_templates
     WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
    [templateId, user.company_id],
  )

  if (!templates.length) {
    return redirect('..')
  }

  return { template: templates[0] }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  const templateId = parseInt(params.templateId ?? '', 10)
  if (Number.isNaN(templateId)) {
    return redirect('..')
  }

  const user: User = await getAdminUser(request)

  await db.execute(
    `UPDATE email_templates SET deleted_at = NOW() WHERE id = ? AND company_id = ?`,
    [templateId, user.company_id],
  )

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Email template deleted'))

  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function DeleteEmailTemplate() {
  const { template } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate('..')
    }
  }

  return (
    <DeleteRow
      handleChange={handleChange}
      title='Delete Email Template'
      description={`Are you sure you want to delete "${template.template_name}"? This action cannot be undone.`}
    />
  )
}
