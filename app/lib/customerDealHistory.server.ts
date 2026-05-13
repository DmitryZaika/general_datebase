import type { Pool } from 'mysql2/promise'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote, DealNoteComment } from '~/routes/api.deal-notes.$dealId'
import { selectMany } from '~/utils/queryHelpers'

export type CustomerDealActivityHistory = DealActivity & {
  deal_list_name: string | null
}

type DealNoteRow = Omit<DealNote, 'comments'>

export async function fetchCustomerDealActivityNoteHistory(
  db: Pool,
  customerId: number,
  companyId: number,
): Promise<{
  activities: CustomerDealActivityHistory[]
  notes: DealNote[]
}> {
  const activities = await selectMany<CustomerDealActivityHistory>(
    db,
    `SELECT da.id, da.deal_id, da.company_id, da.name,
            DATE_FORMAT(da.deadline, '%Y-%m-%dT%H:%i:%sZ') AS deadline,
            da.priority, da.is_completed,
            DATE_FORMAT(da.completed_at, '%Y-%m-%dT%H:%i:%sZ') AS completed_at,
            DATE_FORMAT(da.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
            da.created_by,
            dl.name AS deal_list_name
     FROM deal_activities da
     INNER JOIN deals d ON d.id = da.deal_id AND d.deleted_at IS NULL
     INNER JOIN customers c ON c.id = d.customer_id AND c.company_id = ? AND c.deleted_at IS NULL
     LEFT JOIN deals_list dl ON dl.id = d.list_id AND dl.deleted_at IS NULL
     WHERE d.customer_id = ? AND da.company_id = ? AND da.deleted_at IS NULL
     ORDER BY COALESCE(da.completed_at, da.created_at) DESC, da.id DESC`,
    [companyId, customerId, companyId],
  )

  const noteRows = await selectMany<DealNoteRow>(
    db,
    `SELECT dn.id, dn.deal_id, dn.company_id, dn.content, dn.is_pinned,
            DATE_FORMAT(dn.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
            dn.created_by
     FROM deal_notes dn
     INNER JOIN deals d ON d.id = dn.deal_id AND d.deleted_at IS NULL
     INNER JOIN customers c ON c.id = d.customer_id AND c.company_id = ? AND c.deleted_at IS NULL
     WHERE d.customer_id = ? AND dn.company_id = ? AND dn.deleted_at IS NULL
     ORDER BY dn.is_pinned DESC, dn.created_at DESC, dn.id DESC`,
    [companyId, customerId, companyId],
  )

  const notes: DealNote[] = noteRows.map(r => ({ ...r, comments: [] }))

  if (notes.length > 0) {
    const noteIds = notes.map(n => n.id)
    const comments = await selectMany<DealNoteComment>(
      db,
      `SELECT id, note_id, content,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
              created_by
       FROM deal_note_comments
       WHERE note_id IN (${noteIds.map(() => '?').join(',')}) AND company_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [...noteIds, companyId],
    )
    for (const note of notes) {
      note.comments = comments.filter(c => c.note_id === note.id)
    }
  }

  return { activities, notes }
}
