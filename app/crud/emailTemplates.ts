import type { Pool } from 'mysql2/promise'
import type { LeadGroup } from '~/schemas/emailTemplates'
import { selectMany } from '~/utils/queryHelpers'

export function getLeadGroupsByCompany(db: Pool, companyId: number) {
  return selectMany<LeadGroup>(
    db,
    `SELECT id, name FROM groups_list
     WHERE deleted_at IS NULL AND (company_id = ? OR id = 1)`,
    [companyId],
  )
}
