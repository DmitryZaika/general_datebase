import { replaceTemplateVariables } from '~/services/lambda.server'
import { urlToFile } from '~/utils/attachmentFile.client'
import { buildImageAttachmentPreviews } from '~/utils/emailAttachmentUi'
import type { EmailTemplate, EmailTemplateAttachment } from '~/utils/emailTemplates'

export async function resolveTemplateAttachmentFiles(
  attachments: EmailTemplateAttachment[],
): Promise<File[]> {
  if (attachments.length === 0) return []
  return Promise.all(attachments.map(item => urlToFile(item.url, item.filename)))
}

export async function applyEmailTemplateContent(
  userId: number,
  dealId: number | null,
  customerId: number | null,
  template: EmailTemplate,
) {
  const body = await replaceTemplateVariables(
    userId,
    dealId,
    customerId,
    template.template_body,
  )
  const attachments = template.attachments?.length
    ? await resolveTemplateAttachmentFiles(template.attachments)
    : []

  return {
    subject: template.template_subject,
    body,
    attachments,
    previews: buildImageAttachmentPreviews(attachments),
  }
}
