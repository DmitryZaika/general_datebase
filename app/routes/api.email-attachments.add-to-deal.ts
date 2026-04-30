import type { ActionFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { auditDisplayName } from '~/utils/customerAudit.server'
import { findCustomerDealsForUser } from '~/utils/customerDeals.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

const requestSchema = z.object({
  attachmentId: z.coerce.number().int().min(1),
  customerEmail: z.email().optional(),
  customerName: z.string().optional(),
  dealId: z.coerce.number().int().min(1).optional(),
})

interface EmailAttachmentRow {
  id: number
  url: string
  content_type: string
  content_subtype: string
}

async function addAttachmentToDeal(
  attachmentId: number,
  dealId: number,
  createdBy: string | null,
) {
  const attachments = await selectMany<EmailAttachmentRow>(
    db,
    'SELECT id, url, content_type, content_subtype FROM email_attachments WHERE id = ? LIMIT 1',
    [attachmentId],
  )
  const attachment = attachments[0]

  if (!attachment) {
    return data({ error: 'Attachment not found' }, { status: 404 })
  }

  const contentType = attachment.content_type.toLowerCase()
  const tableName =
    contentType === 'image' || contentType.startsWith('image/')
      ? 'deals_images'
      : 'deals_documents'

  if (tableName === 'deals_images') {
    await db.execute(
      `INSERT INTO deals_images (deal_id, image_url, created_by)
       SELECT ?, ?, ?
         FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM deals_images WHERE deal_id = ? AND image_url = ?
        )`,
      [dealId, attachment.url, createdBy, dealId, attachment.url],
    )
  } else {
    await db.execute(
      `INSERT INTO deals_documents (deal_id, image_url, created_by)
       SELECT ?, ?, ?
         FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM deals_documents WHERE deal_id = ? AND image_url = ?
        )`,
      [dealId, attachment.url, createdBy, dealId, attachment.url],
    )
  }

  return null
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })
  const attachmentCreatedBy = auditDisplayName(user)

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return data({ error: 'Invalid request' }, { status: 400 })
  }

  const deals = await findCustomerDealsForUser(
    user.id,
    user.company_id,
    parsed.data.customerEmail,
    parsed.data.customerName,
  )

  if (parsed.data.dealId) {
    const selectedDeal = deals.find(deal => deal.id === parsed.data.dealId)
    if (!selectedDeal) {
      return data({ error: 'Deal not found for this customer' }, { status: 404 })
    }

    const addError = await addAttachmentToDeal(
      parsed.data.attachmentId,
      parsed.data.dealId,
      attachmentCreatedBy,
    )
    if (addError) return addError

    return data({ status: 'added', deal: selectedDeal })
  }

  if (deals.length === 0) {
    return data({ error: 'No deals found for this customer' }, { status: 404 })
  }

  if (deals.length > 1) {
    return data({ status: 'select', deals })
  }

  const deal = deals[0]
  const addError = await addAttachmentToDeal(
    parsed.data.attachmentId,
    deal.id,
    attachmentCreatedBy,
  )
  if (addError) return addError

  return data({ status: 'added', deal })
}
