import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import {
  getAttachmentsForCompanyTemplates,
  groupAttachmentsByTemplateId,
} from '~/utils/emailTemplateAttachments.server'
import { type EmailTemplate, mapTemplateAttachmentRows } from '~/utils/emailTemplates'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    posthogClient.captureException(error)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = parseInt(params.companyId ?? '', 10)
  if (Number.isNaN(companyId) || user.company_id !== companyId) {
    posthogClient.captureException(new Error('Invalid company ID'))
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

  const attachmentRows = await getAttachmentsForCompanyTemplates(companyId)
  const attachmentsByTemplate = groupAttachmentsByTemplateId(attachmentRows)

  const templatesWithAttachments = templates.map(template => ({
    ...template,
    attachments: mapTemplateAttachmentRows(
      attachmentsByTemplate.get(template.id) ?? [],
    ),
  }))

  return Response.json({ templates: templatesWithAttachments })
}
