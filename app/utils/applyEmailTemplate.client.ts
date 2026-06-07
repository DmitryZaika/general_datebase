import type { TemplateVariableData } from '~/services/types'
import { urlToFile } from '~/utils/attachmentFile.client'
import { buildImageAttachmentPreviews } from '~/utils/emailAttachmentUi'
import type { EmailTemplate, EmailTemplateAttachment } from '~/utils/emailTemplates'
import { replaceTemplateVariables } from '~/utils/emailTemplateVariables'

export async function resolveTemplateAttachmentFiles(
  attachments: EmailTemplateAttachment[],
): Promise<File[]> {
  if (attachments.length === 0) return []
  return Promise.all(attachments.map(item => urlToFile(item.url, item.filename)))
}

export async function applyEmailTemplateContent(
  template: EmailTemplate,
  templateVariableData: TemplateVariableData,
) {
  const body = replaceTemplateVariables(template.template_body, templateVariableData)
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
