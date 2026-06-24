import {
  getEmailAttachmentImageSrc,
  isEmailAttachmentImage,
  isHeicEmailAttachment,
} from '~/utils/emailAttachmentUi'

export type EmailAttachmentPreviewSource = {
  id: number
  signed_url?: string
  url: string
  content_type: string
  content_subtype: string
  filename: string
}

const previewUrlCache = new Map<number, string>()

export function revokeEmailAttachmentPreviewCache() {
  for (const url of previewUrlCache.values()) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  }
  previewUrlCache.clear()
}

async function convertHeicInBrowser(heicBlob: Blob): Promise<string | null> {
  try {
    const heic2any = (await import('heic2any')).default
    const result = await heic2any({
      blob: heicBlob,
      toType: 'image/jpeg',
      quality: 0.92,
    })
    const jpegBlob = Array.isArray(result) ? result[0] : result
    if (!jpegBlob) return null
    return URL.createObjectURL(jpegBlob as Blob)
  } catch {
    return null
  }
}

async function fetchHeicBlob(attachmentId: number): Promise<Blob | null> {
  const rawPath = `/api/email-attachments/${attachmentId}/raw`
  const res = await fetch(rawPath, { credentials: 'include' })
  if (!res.ok) return null
  return await res.blob()
}

export async function resolveEmailAttachmentDisplayUrl(
  attachment: EmailAttachmentPreviewSource,
): Promise<string | null> {
  const direct = attachment.signed_url || attachment.url
  if (!direct) return null

  if (!isHeicEmailAttachment(attachment)) {
    return getEmailAttachmentImageSrc(attachment) ?? direct
  }

  if (attachment.id <= 0) return direct

  const cached = previewUrlCache.get(attachment.id)
  if (cached) return cached

  const previewPath = `/api/email-attachments/${attachment.id}/preview`
  try {
    const res = await fetch(previewPath, { credentials: 'include' })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      previewUrlCache.set(attachment.id, url)
      return url
    }
  } catch {
    // fall through to client conversion
  }

  const heicBlob = await fetchHeicBlob(attachment.id)
  if (!heicBlob) return null

  const clientUrl = await convertHeicInBrowser(heicBlob)
  if (clientUrl) {
    previewUrlCache.set(attachment.id, clientUrl)
    return clientUrl
  }

  return null
}

export async function buildEmailCarouselImages(
  attachments: EmailAttachmentPreviewSource[],
) {
  const imageAttachments = attachments.filter(
    a => isEmailAttachmentImage(a) && (a.signed_url || a.url),
  )

  return Promise.all(
    imageAttachments.map(async img => ({
      id: img.id,
      url: (await resolveEmailAttachmentDisplayUrl(img)) ?? '',
      name: img.filename || `${img.content_type}/${img.content_subtype}`,
      type: 'email',
      available: null as null,
    })),
  )
}
