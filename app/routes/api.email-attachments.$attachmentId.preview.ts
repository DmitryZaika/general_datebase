import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import {
  isEmailAttachmentImage,
  isHeicEmailAttachment,
} from '~/utils/emailAttachmentUi'
import { detectMime } from '~/utils/files'
import { convertHeicToJpeg } from '~/utils/files.server'
import { selectMany } from '~/utils/queryHelpers'
import { downloadObjectAsBuffer } from '~/utils/s3.server'
import { presignIfS3Uri } from '~/utils/s3Presign.server'
import { getEmployeeUser } from '~/utils/session.server'

type AttachmentRow = {
  id: number
  url: string
  content_type: string
  content_subtype: string
  filename: string
  email_company_id: number | null
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user: { company_id: number }
  try {
    user = await getEmployeeUser(request)
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const attachmentId = Number(params.attachmentId)
  if (!Number.isFinite(attachmentId) || attachmentId <= 0) {
    return new Response('Not found', { status: 404 })
  }

  try {
    const attachmentRows = await selectMany<AttachmentRow>(
      db,
      `SELECT ea.id, ea.url, ea.content_type, ea.content_subtype, ea.filename,
              u_sender.company_id AS email_company_id
       FROM email_attachments ea
       JOIN emails e ON e.id = ea.email_id
       LEFT JOIN users u_sender ON u_sender.id = e.sender_user_id
       WHERE ea.id = ?
       LIMIT 1`,
      [attachmentId],
    )

    const attachment = attachmentRows[0]
    if (!attachment) {
      return new Response('Not found', { status: 404 })
    }

    if (
      attachment.email_company_id !== null &&
      attachment.email_company_id !== user.company_id
    ) {
      return new Response('Forbidden', { status: 403 })
    }

    if (!isEmailAttachmentImage(attachment)) {
      return new Response('Not an image', { status: 400 })
    }

    const isHeic = isHeicEmailAttachment(attachment)

    if (!isHeic) {
      const type = attachment.content_type.trim().toLowerCase()
      const subtype = attachment.content_subtype.trim().toLowerCase()
      const mime = type && subtype ? `${type}/${subtype}` : null
      const signed = await presignIfS3Uri(attachment.url, 3600, 'inline', mime)
      return new Response(null, { status: 302, headers: { Location: signed } })
    }

    const downloaded = await downloadObjectAsBuffer(attachment.url)
    if (!downloaded?.buffer) {
      return new Response('Failed to load attachment', { status: 502 })
    }

    try {
      const jpeg = await convertHeicToJpeg(downloaded.buffer)
      return new Response(new Uint8Array(jpeg), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'private, max-age=3600',
        },
      })
    } catch {
      const detectedMime = await detectMime(
        downloaded.buffer,
        downloaded.contentType,
        attachment.filename || downloaded.filename,
      )
      if (
        detectedMime &&
        detectedMime !== 'image/heic' &&
        detectedMime !== 'image/heif'
      ) {
        const signed = await presignIfS3Uri(
          attachment.url,
          3600,
          'inline',
          detectedMime,
        )
        return new Response(null, { status: 302, headers: { Location: signed } })
      }
      return new Response('Failed to convert image', { status: 500 })
    }
  } catch {
    return new Response('Internal error', { status: 500 })
  }
}
