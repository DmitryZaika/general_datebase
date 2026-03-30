import { zodResolver } from '@hookform/resolvers/zod'
import type { ResultSetHeader } from 'mysql2'
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
  validateAutoSendVariables,
} from '~/schemas/emailTemplates'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

const resolver = zodResolver(emailTemplateSchema)

export async function loader({ request }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const groups = await getLeadGroupsByCompany(db, user.company_id)
  return { groups }
}

export async function action({ request }: ActionFunctionArgs) {
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

  const { errors, data } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors }
  }

  const validationError = validateAutoSendVariables(data)
  if (validationError) return validationError

  const { leadGroupId, hourDelay, showTemplate } = parseAutoSendFields(data)

  try {
    await db.execute<ResultSetHeader>(
      `INSERT INTO email_templates
         (template_name, template_subject, template_body,
          lead_group_id, hour_delay, show_template, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.template_name,
        data.template_subject,
        data.template_body,
        leadGroupId,
        hourDelay,
        showTemplate ? 1 : 0,
        user.company_id,
      ],
    )
  } catch (error) {
    if (isDuplicateGroupError(error)) return DUPLICATE_GROUP_ERROR
    throw error
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Email template created'))

  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

const defaultValues: EmailTemplateFormData = {
  template_name: '',
  template_subject: '',
  template_body: '',
  lead_group_id: '',
  hour_delay: '',
  show_template: false,
}

export default function AddEmailTemplate() {
  const { groups } = useLoaderData<typeof loader>()
  // zodResolver input type is wider (string|boolean for show_template)
  // but the form only produces boolean values from the Switch component
  const form = useForm({
    resolver,
    defaultValues,
  }) as UseFormReturn<EmailTemplateFormData>

  return (
    <EmailTemplateForm title='Add New Email Template' form={form} groups={groups} />
  )
}
