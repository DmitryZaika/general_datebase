import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { downloadObjectAsBuffer } from '~/utils/s3.server'
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

  const downloaded = await downloadObjectAsBuffer(attachment.url)
  if (!downloaded?.buffer) {
    return new Response('Failed to load attachment', { status: 502 })
  }

  const type = attachment.content_type.trim().toLowerCase()
  const subtype = attachment.content_subtype.trim().toLowerCase()
  const contentType = type && subtype ? `${type}/${subtype}` : downloaded.contentType

  return new Response(new Uint8Array(downloaded.buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
