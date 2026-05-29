import type { ResultSetHeader } from 'mysql2'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/db.server'
import { emailTemplateTextSchema } from '~/utils/emailTemplateSchema'
import { selectMany } from '~/utils/queryHelpers'
import { uploadStreamToS3 } from '~/utils/s3.server'

export type { EmailTemplateTextData } from '~/utils/emailTemplateSchema'
export { emailTemplateTextSchema } from '~/utils/emailTemplateSchema'

export interface EmailTemplateAttachmentRow {
  id: number
  template_id: number
  content_type: string
  content_subtype: string
  filename: string
  url: string
  position: number
}

const TEMPLATE_ATTACHMENT_FOLDER = 'email-templates'

export async function getTemplateAttachments(
  templateId: number,
): Promise<EmailTemplateAttachmentRow[]> {
  return selectMany<EmailTemplateAttachmentRow>(
    db,
    `SELECT id, template_id, content_type, content_subtype, filename, url, position
       FROM email_template_attachments
      WHERE template_id = ? AND deleted_at IS NULL
      ORDER BY position ASC, id ASC`,
    [templateId],
  )
}

export async function getAttachmentsForCompanyTemplates(companyId: number) {
  return selectMany<EmailTemplateAttachmentRow>(
    db,
    `SELECT eta.id, eta.template_id, eta.content_type, eta.content_subtype, eta.filename, eta.url, eta.position
       FROM email_template_attachments eta
       INNER JOIN email_templates et ON et.id = eta.template_id
      WHERE et.company_id = ?
        AND et.deleted_at IS NULL
        AND eta.deleted_at IS NULL
      ORDER BY eta.template_id ASC, eta.position ASC, eta.id ASC`,
    [companyId],
  )
}

export function groupAttachmentsByTemplateId(
  rows: EmailTemplateAttachmentRow[],
): Map<number, EmailTemplateAttachmentRow[]> {
  const grouped = new Map<number, EmailTemplateAttachmentRow[]>()
  for (const row of rows) {
    const current = grouped.get(row.template_id) ?? []
    current.push(row)
    grouped.set(row.template_id, current)
  }
  return grouped
}

async function uploadTemplateAttachment(file: File) {
  const ab = await file.arrayBuffer()
  const buffer = Buffer.from(ab)
  const filename = `${uuidv4()}-${file.name}`
  const url = await uploadStreamToS3(
    (async function* () {
      yield new Uint8Array(buffer)
    })(),
    filename,
    TEMPLATE_ATTACHMENT_FOLDER,
  )
  const [type, subtype] = (file.type || 'application/octet-stream').split('/')
  return {
    contentType: type ?? 'application',
    contentSubtype: subtype ?? '',
    filename: file.name,
    url: url ?? '',
  }
}

export async function saveTemplateAttachments(
  templateId: number,
  newFiles: File[],
  removedAttachmentIds: number[],
) {
  if (removedAttachmentIds.length > 0) {
    const placeholders = removedAttachmentIds.map(() => '?').join(', ')
    await db.execute(
      `UPDATE email_template_attachments
          SET deleted_at = NOW()
        WHERE template_id = ?
          AND deleted_at IS NULL
          AND id IN (${placeholders})`,
      [templateId, ...removedAttachmentIds],
    )
  }

  if (newFiles.length === 0) return

  const existing = await getTemplateAttachments(templateId)
  let position =
    existing.length > 0 ? Math.max(...existing.map(item => item.position)) + 1 : 0

  for (const file of newFiles) {
    const uploaded = await uploadTemplateAttachment(file)
    await db.execute<ResultSetHeader>(
      `INSERT INTO email_template_attachments
        (template_id, content_type, content_subtype, filename, url, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        uploaded.contentType,
        uploaded.contentSubtype,
        uploaded.filename,
        uploaded.url,
        position,
      ],
    )
    position += 1
  }
}

export async function softDeleteTemplateAttachments(templateId: number) {
  await db.execute(
    `UPDATE email_template_attachments
        SET deleted_at = NOW()
      WHERE template_id = ? AND deleted_at IS NULL`,
    [templateId],
  )
}

export async function parseEmailTemplateMultipartRequest(request: Request) {
  const formData = await request.formData()
  const textData = {
    template_name: String(formData.get('template_name') ?? ''),
    template_subject: String(formData.get('template_subject') ?? ''),
    template_body: String(formData.get('template_body') ?? ''),
  }

  const parsed = emailTemplateTextSchema.safeParse(textData)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, data: null }
  }

  const removedRaw = formData.get('removed_attachment_ids')
  let removedAttachmentIds: number[] = []
  if (typeof removedRaw === 'string' && removedRaw.trim()) {
    try {
      const parsedRemoved = JSON.parse(removedRaw)
      if (Array.isArray(parsedRemoved)) {
        removedAttachmentIds = parsedRemoved.filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value),
        )
      }
    } catch {
      return {
        errors: { removed_attachment_ids: ['Invalid removed attachments payload'] },
        data: null,
      }
    }
  }

  const attachments = formData
    .getAll('attachments')
    .filter((value): value is File => value instanceof File && value.size > 0)

  return {
    errors: null,
    data: {
      ...parsed.data,
      attachments,
      removed_attachment_ids: removedAttachmentIds,
    },
  }
}
