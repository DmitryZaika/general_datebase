import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { z } from 'zod'
import {
  EmailTemplateForm,
  type EmailTemplateFormData,
} from '~/components/molecules/EmailTemplateForm'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import {
  getTemplateAttachments,
  parseEmailTemplateMultipartRequest,
  saveTemplateAttachments,
} from '~/utils/emailTemplateAttachments.server'
import { emailTemplateTextSchema } from '~/utils/emailTemplateSchema'
import { mapTemplateAttachmentRows } from '~/utils/emailTemplates'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

interface EmailTemplate {
  id: number
  template_name: string
  template_subject: string
  template_body: string
}

const templateFormSchema = emailTemplateTextSchema.extend({
  attachments: z.array(z.instanceof(File)),
  removed_attachment_ids: z.array(z.number()),
})

const resolver = zodResolver(templateFormSchema)

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const templateId = parseInt(params.templateId ?? '', 10)
  if (Number.isNaN(templateId)) {
    return redirect('..')
  }

  const templates = await selectMany<EmailTemplate>(
    db,
    `SELECT id, template_name, template_subject, template_body
     FROM email_templates
     WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
    [templateId, user.company_id],
  )

  if (templates.length === 0) {
    return redirect('..')
  }

  const attachmentRows = await getTemplateAttachments(templateId)

  return {
    template: templates[0],
    companyId: user.company_id,
    attachments: mapTemplateAttachmentRows(attachmentRows),
  }
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

  const templateId = parseInt(params.templateId ?? '', 10)
  if (Number.isNaN(templateId)) {
    return redirect('..')
  }

  const parsed = await parseEmailTemplateMultipartRequest(request)
  if (parsed.errors) {
    return { errors: parsed.errors }
  }
  if (!parsed.data) {
    return { error: 'Invalid template data' }
  }

  const validated = templateFormSchema.safeParse(parsed.data)
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  await db.execute(
    `UPDATE email_templates
     SET template_name = ?, template_subject = ?, template_body = ?
     WHERE id = ? AND company_id = ?`,
    [
      validated.data.template_name,
      validated.data.template_subject,
      validated.data.template_body,
      templateId,
      user.company_id,
    ],
  )

  await saveTemplateAttachments(
    templateId,
    validated.data.attachments,
    validated.data.removed_attachment_ids,
  )

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Email template updated'))

  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function EditEmailTemplate() {
  const { template, companyId, attachments } = useLoaderData<typeof loader>()

  const form = useForm<EmailTemplateFormData>({
    resolver,
    defaultValues: {
      template_name: template.template_name,
      template_subject: template.template_subject,
      template_body: template.template_body,
      attachments: [],
      removed_attachment_ids: [],
    },
  })

  return (
    <EmailTemplateForm
      title='Edit Email Template'
      form={form}
      companyId={companyId}
      existingAttachments={attachments}
      isEditMode
    />
  )
}
