import { type LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface EmailTemplate {
  id: number
  template_name: string
  template_subject: string
  template_body: string
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user
  try {
    user = await getEmployeeUser(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = parseInt(params.companyId ?? '', 10)
  if (isNaN(companyId) || user.company_id !== companyId) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const templates = await selectMany<EmailTemplate>(
    db,
    `SELECT id, template_name, template_subject, template_body
     FROM email_templates
     WHERE company_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [companyId],
  )

  return Response.json({ templates })
}
