const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'svg',
  'heic',
  'heif',
  'tiff',
  'tif',
])

const HEIC_EXTENSIONS = new Set(['heic', 'heif'])

type EmailAttachmentLike = {
  content_type?: string | null
  content_subtype?: string | null
  filename?: string | null
}

export function emailAttachmentMime(attachment: EmailAttachmentLike): string {
  const type = (attachment.content_type || '').trim().toLowerCase()
  const subtype = (attachment.content_subtype || '').trim().toLowerCase()
  if (!type) return ''
  if (!subtype) return type
  return `${type}/${subtype}`
}

export function isHeicEmailAttachment(attachment: EmailAttachmentLike): boolean {
  const mime = emailAttachmentMime(attachment)
  if (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime.includes('heic') ||
    mime.includes('heif')
  ) {
    return true
  }
  const type = (attachment.content_type || '').trim().toLowerCase()
  if (type.includes('heic') || type.includes('heif')) return true
  const subtype = (attachment.content_subtype || '').trim().toLowerCase()
  if (subtype === 'heic' || subtype === 'heif') return true
  const parts = (attachment.filename || '').split('.')
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
  return HEIC_EXTENSIONS.has(ext)
}

export function isEmailAttachmentImage(attachment: EmailAttachmentLike): boolean {
  const type = (attachment.content_type || '').trim().toLowerCase()
  if (type === 'image' || type.startsWith('image/')) return true
  if (isHeicEmailAttachment(attachment)) return true
  return isImageFileName(attachment.filename || '')
}

export function getEmailAttachmentImageSrc(
  attachment: EmailAttachmentLike & { id: number; signed_url?: string; url: string },
): string | undefined {
  const href = attachment.signed_url || attachment.url
  if (!href) return undefined
  if (isHeicEmailAttachment(attachment) && attachment.id > 0) {
    return `/api/email-attachments/${attachment.id}/preview`
  }
  return href
}

export function attachmentPreviewKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

export function isImageFileName(fileName: string): boolean {
  const parts = fileName.split('.')
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
  return IMAGE_EXTENSIONS.has(ext)
}

export function buildImageAttachmentPreviews(files: File[]): Record<string, string> {
  const previews: Record<string, string> = {}
  for (const file of files) {
    if (!isImageFileName(file.name)) continue
    previews[attachmentPreviewKey(file)] = URL.createObjectURL(file)
  }
  return previews
}
