import { z } from 'zod'
import { validateTemplateBody } from '~/utils/emailTemplateVariables'

export const emailTemplateTextSchema = z.object({
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

export type EmailTemplateTextData = z.infer<typeof emailTemplateTextSchema>
