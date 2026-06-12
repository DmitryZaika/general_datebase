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
  // 1. Call your new React Router / Remix resource route endpoint
  // Note: Adjust '/api/emailTemplate/fill' if your routing configuration maps dot-delimiters differently
  const response = await fetch('/api/emailTemplate/fill', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      dealId,
      customerId,
      template: template.template_body,
    }),
  })

  // 2. Handle HTTP layer errors
  if (!response.ok) {
    throw new Error(`Network response error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // 3. Handle validation or application layer errors returned by your action
  if (!data.success) {
    throw new Error(data.error || 'Failed to populate email template variables.')
  }

  // 4. Extract the cleanly formatted body string from the success payload
  const body = data.result

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
