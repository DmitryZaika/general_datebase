import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

export interface CustomerDealNotePreview {
  id: number
  deal_id: number
  content: string
  created_at: string
}

export interface CustomerDealActivityPreview {
  id: number
  deal_id: number
  name: string
  deadline: string | null
  priority: string
  is_completed: number
}

export interface CustomerDealOption {
  id: number
  title: string | null
  status: string | null
  amount: number | null
  list_name: string | null
  notes: CustomerDealNotePreview[]
  activities: CustomerDealActivityPreview[]
}

export async function findCustomerDealsForUser(
  userId: number,
  companyId: number,
  customerEmail?: string,
  customerName?: string,
): Promise<CustomerDealOption[]> {
  const email = customerEmail?.trim() ?? ''
  const name = customerName?.trim() ?? ''
  if (!email && !name) return []

  const deals = await selectMany<Omit<CustomerDealOption, 'notes' | 'activities'>>(
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
  const notes = await selectMany<CustomerDealNotePreview>(
    db,
    `SELECT id, deal_id, content, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') created_at
       FROM deal_notes
      WHERE deal_id IN (?) AND company_id = ? AND deleted_at IS NULL
      ORDER BY is_pinned DESC, created_at DESC`,
    [dealIds, companyId],
  )
  const activities = await selectMany<CustomerDealActivityPreview>(
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
