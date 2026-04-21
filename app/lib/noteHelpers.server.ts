import type { Pool } from 'mysql2/promise'
import type { DealNote, DealNoteComment } from '~/routes/api.deal-notes.$dealId'
import { selectMany } from '~/utils/queryHelpers'

type DealNoteRow = Omit<DealNote, 'comments'>

export async function fetchNotesWithComments(
  db: Pool,
  dealId: number,
  companyId: number,
): Promise<DealNote[]> {
  const noteRows = await selectMany<DealNoteRow>(
    db,
    `SELECT id, deal_id, company_id, content, is_pinned,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
            created_by
     FROM deal_notes
     WHERE deal_id = ? AND company_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [dealId, companyId],
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

  return notes
}
