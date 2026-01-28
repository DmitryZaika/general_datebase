import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { EmailTemplateForm } from '~/components/molecules/EmailTemplateForm'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { validateTemplateBody } from '~/utils/emailTemplateVariables'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

interface EmailTemplate {
  id: number
  template_name: string
  template_subject: string
  template_body: string
}

const templateSchema = z.object({
  template_name: z.string().min(1, 'Template name is required'),
  template_subject: z.string().min(1, 'Template subject is required'),
  template_body: z
    .string()
    .min(1, 'Template body is required')
    .refine(
      (val: string) => {
        const text = val.replace(/<[^>]*>/g, '')
        const validation = validateTemplateBody(text)
        return validation.isValid
      },
      {
        message: 'Invalid template body format. Check for unclosed {{ or }}.',
      },
    ),
})

type FormData = z.infer<typeof templateSchema>

const resolver = zodResolver(templateSchema)

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const templateId = parseInt(params.templateId ?? '', 10)
  if (isNaN(templateId)) {
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

  return { template: templates[0] }
}

export async function action({ request, params }: ActionFunctionArgs) {
  let user
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
  if (isNaN(templateId)) {
    return redirect('..')
  }

  const { errors, data } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors }
  }

  await db.execute(
    `UPDATE email_templates
     SET template_name = ?, template_subject = ?, template_body = ?
     WHERE id = ? AND company_id = ?`,
    [data.template_name, data.template_subject, data.template_body, templateId, user.company_id],
  )

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Email template updated'))

  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function EditEmailTemplate() {
  const { template } = useLoaderData<typeof loader>()

  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      template_name: template.template_name,
      template_subject: template.template_subject,
      template_body: template.template_body,
    },
  })

  return <EmailTemplateForm title='Edit Email Template' form={form} isEditMode />
}
