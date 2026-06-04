const GMAIL_REACTION_BODY_PATTERN = /\breacted via gmail\b/i

const GMAIL_REACTION_ATTACHMENT_FILENAME =
  /^attachment-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$/i

const GMAIL_REACTION_ATTACHMENT_INLINE =
  /\battachment-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin\b/gi

type EmailAttachmentLike = {
  filename?: string | null
  content_type?: string
  content_subtype?: string
}

function emailBodyPlainText(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isGmailReactionEmailBody(body: string): boolean {
  return GMAIL_REACTION_BODY_PATTERN.test(emailBodyPlainText(body))
}

export function isGmailReactionAttachment(attachment: EmailAttachmentLike): boolean {
  const filename = (attachment.filename || '').trim()
  if (GMAIL_REACTION_ATTACHMENT_FILENAME.test(filename)) return true
  const mime =
    `${attachment.content_type || ''}/${attachment.content_subtype || ''}`.toLowerCase()
  return mime.includes('mail-reaction')
}

export function filterVisibleEmailAttachments<T extends EmailAttachmentLike>(
  attachments: T[],
): T[] {
  return attachments.filter(attachment => !isGmailReactionAttachment(attachment))
}

export function emailSnippetFromBody(body: string, maxLength = 100): string {
  let text = body.replace(/<[^>]*>?/gm, '')
  if (isGmailReactionEmailBody(text)) {
    text = stripGmailReactionNoiseFromBody(text)
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function stripGmailReactionNoiseFromBody(body: string): string {
  let cleaned = body.replace(
    /<a\b[^>]*>[\s\S]*?attachment-[0-9a-f-]{36}\.bin[\s\S]*?<\/a>/gi,
    '',
  )
  cleaned = cleaned.replace(GMAIL_REACTION_ATTACHMENT_INLINE, '')
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim()
  return cleaned
}
