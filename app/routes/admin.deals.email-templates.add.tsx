import { zodResolver } from '@hookform/resolvers/zod'
import type { ResultSetHeader } from 'mysql2'
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
  parseEmailTemplateMultipartRequest,
  saveTemplateAttachments,
} from '~/utils/emailTemplateAttachments.server'
import { emailTemplateTextSchema } from '~/utils/emailTemplateSchema'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

const templateFormSchema = emailTemplateTextSchema.extend({
  attachments: z.array(z.instanceof(File)),
  removed_attachment_ids: z.array(z.number()),
})

const resolver = zodResolver(templateFormSchema)

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    return { companyId: user.company_id }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
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

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO email_templates (template_name, template_subject, template_body, company_id)
     VALUES (?, ?, ?, ?)`,
    [
      validated.data.template_name,
      validated.data.template_subject,
      validated.data.template_body,
      user.company_id,
    ],
  )

  await saveTemplateAttachments(
    result.insertId,
    validated.data.attachments,
    validated.data.removed_attachment_ids,
  )

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
  attachments: [],
  removed_attachment_ids: [],
}

export default function AddEmailTemplate() {
  const { companyId } = useLoaderData<typeof loader>()
  const form = useForm<EmailTemplateFormData>({ resolver, defaultValues })

  return (
    <EmailTemplateForm
      title='Add New Email Template'
      form={form}
      companyId={companyId}
    />
  )
}
