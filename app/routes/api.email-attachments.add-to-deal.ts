import type { ActionFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

const requestSchema = z.object({
  attachmentId: z.coerce.number().int().min(1),
  customerEmail: z.email().optional(),
  customerName: z.string().optional(),
  dealId: z.coerce.number().int().min(1).optional(),
})

interface DealOption {
  id: number
  title: string | null
  status: string | null
  amount: number | null
  list_name: string | null
  notes: DealNotePreview[]
  activities: DealActivityPreview[]
}

interface EmailAttachmentRow {
  id: number
  url: string
  content_type: string
  content_subtype: string
}

interface DealNotePreview {
  id: number
  deal_id: number
  content: string
  created_at: string
}

interface DealActivityPreview {
  id: number
  deal_id: number
  name: string
  deadline: string | null
  priority: string
  is_completed: number
}

async function findDeals(
  userId: number,
  companyId: number,
  customerEmail?: string,
  customerName?: string,
) {
  const email = customerEmail?.trim() ?? ''
  const name = customerName?.trim() ?? ''
  if (!email && !name) return []

  const deals = await selectMany<Omit<DealOption, 'notes' | 'activities'>>(
    db,
    `SELECT d.id, d.title, d.status, d.amount, dl.name list_name
       FROM deals d
       JOIN customers c ON c.id = d.customer_id
       LEFT JOIN deals_list dl ON dl.id = d.list_id
      WHERE d.deleted_at IS NULL
        AND c.company_id = ?
        AND c.deleted_at IS NULL
        AND (
          (? != '' AND LOWER(c.email) = LOWER(?))
          OR (? != '' AND LOWER(c.name) = LOWER(?))
        )
      ORDER BY CASE WHEN d.user_id = ? THEN 0 ELSE 1 END, d.id DESC`,
    [companyId, email, email, name, name, userId],
  )

  if (deals.length === 0) return []

  const dealIds = deals.map(deal => deal.id)
  const notes = await selectMany<DealNotePreview>(
    db,
    `SELECT id, deal_id, content, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') created_at
       FROM deal_notes
      WHERE deal_id IN (?) AND company_id = ? AND deleted_at IS NULL
      ORDER BY is_pinned DESC, created_at DESC`,
    [dealIds, companyId],
  )
  const activities = await selectMany<DealActivityPreview>(
    db,
    `SELECT id, deal_id, name, DATE_FORMAT(deadline, '%Y-%m-%dT%H:%i:%sZ') deadline, priority, is_completed
       FROM deal_activities
      WHERE deal_id IN (?) AND company_id = ? AND deleted_at IS NULL
      ORDER BY is_completed ASC, deadline IS NULL ASC, deadline ASC, created_at DESC`,
    [dealIds, companyId],
  )

  return deals.map(deal => ({
    ...deal,
    notes: notes.filter(note => note.deal_id === deal.id).slice(0, 2),
    activities: activities.filter(activity => activity.deal_id === deal.id).slice(0, 2),
  }))
}

async function addAttachmentToDeal(attachmentId: number, dealId: number) {
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
      `INSERT INTO deals_images (deal_id, image_url)
       SELECT ?, ?
         FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM deals_images WHERE deal_id = ? AND image_url = ?
        )`,
      [dealId, attachment.url, dealId, attachment.url],
    )
  } else {
    await db.execute(
      `INSERT INTO deals_documents (deal_id, image_url)
       SELECT ?, ?
         FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM deals_documents WHERE deal_id = ? AND image_url = ?
        )`,
      [dealId, attachment.url, dealId, attachment.url],
    )
  }

  return null
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) return data({ error: 'Unauthorized' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return data({ error: 'Invalid request' }, { status: 400 })
  }

  const deals = await findDeals(
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
  const addError = await addAttachmentToDeal(parsed.data.attachmentId, deal.id)
  if (addError) return addError

  return data({ status: 'added', deal })
}
