import { zodResolver } from '@hookform/resolvers/zod'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { EmailTemplateForm } from '~/components/molecules/EmailTemplateForm'
import { getLeadGroupsByCompany } from '~/crud/emailTemplates'
import { db } from '~/db.server'
import {
  DUPLICATE_GROUP_ERROR,
  type EmailTemplateFormData,
  emailTemplateSchema,
  isDuplicateGroupError,
  parseAutoSendFields,
  validateAutoSendFields,
} from '~/schemas/emailTemplates'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

interface EmailTemplate {
  id: number
  template_name: string
  template_subject: string
  template_body: string
  lead_group_id: number | null
  hour_delay: number | null
  show_template: number
}

const resolver = zodResolver(emailTemplateSchema)

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

  const [templates, groups] = await Promise.all([
    selectMany<EmailTemplate>(
      db,
      `SELECT id, template_name, template_subject, template_body,
              lead_group_id, hour_delay, show_template
       FROM email_templates
       WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
      [templateId, user.company_id],
    ),
    getLeadGroupsByCompany(db, user.company_id),
  ])

  if (templates.length === 0) {
    return redirect('..')
  }

  return { template: templates[0], groups }
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

  const { errors, data } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors }
  }

  const validationError = validateAutoSendFields(data)
  if (validationError) return validationError

  const { leadGroupId, hourDelay, showTemplate } = parseAutoSendFields(data)

  try {
    await db.execute(
      `UPDATE email_templates
       SET template_name = ?, template_subject = ?, template_body = ?,
           lead_group_id = ?, hour_delay = ?, show_template = ?
       WHERE id = ? AND company_id = ?`,
      [
        data.template_name,
        data.template_subject,
        data.template_body,
        leadGroupId,
        hourDelay,
        showTemplate ? 1 : 0,
        templateId,
        user.company_id,
      ],
    )
  } catch (error) {
    if (isDuplicateGroupError(error)) return DUPLICATE_GROUP_ERROR
    throw error
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Email template updated'))

  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function EditEmailTemplate() {
  const { template, groups } = useLoaderData<typeof loader>()

  // zodResolver input type is wider (string|boolean for show_template)
  // but the form only produces boolean values from the Switch component
  const form = useForm({
    resolver,
    defaultValues: {
      template_name: template.template_name,
      template_subject: template.template_subject,
      template_body: template.template_body,
      lead_group_id: template.lead_group_id?.toString() ?? '',
      hour_delay: template.hour_delay?.toString() ?? '',
      show_template: Boolean(template.show_template),
    },
  }) as UseFormReturn<EmailTemplateFormData>

  return (
    <EmailTemplateForm
      title='Edit Email Template'
      form={form}
      groups={groups}
      isEditMode
    />
  )
}
