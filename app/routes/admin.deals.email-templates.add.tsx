import { zodResolver } from '@hookform/resolvers/zod'
import type { ResultSetHeader } from 'mysql2'
import { useForm } from 'react-hook-form'
import { type ActionFunctionArgs, redirect } from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { EmailTemplateForm } from '~/components/molecules/EmailTemplateForm'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { validateTemplateBody } from '~/utils/emailTemplateVariables'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

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

export async function action({ request }: ActionFunctionArgs) {
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

  const { errors, data } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors }
  }

  await db.execute<ResultSetHeader>(
    `INSERT INTO email_templates (template_name, template_subject, template_body, company_id)
     VALUES (?, ?, ?, ?)`,
    [data.template_name, data.template_subject, data.template_body, user.company_id],
  )

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Email template created'))

  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

const defaultValues: FormData = {
  template_name: '',
  template_subject: '',
  template_body: '',
}

export default function AddEmailTemplate() {
  const form = useForm<FormData>({ resolver, defaultValues })

  return <EmailTemplateForm title='Add New Email Template' form={form} />
}
