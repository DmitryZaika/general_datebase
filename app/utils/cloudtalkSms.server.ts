import { db } from '~/db.server'
import { phoneVariants } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import type { SmsRow } from '~/utils/smsDisplayHelpers'

export interface FetchSmsParams {
  companyId: number
  phoneDigits: string[]
  createdAfter?: Date
  limit?: number
}

export async function fetchSmsForCompanyAndPhones({
  companyId,
  phoneDigits,
  createdAfter,
  limit = 200,
}: FetchSmsParams): Promise<{ items: SmsRow[] }> {
  const variants = [...new Set(phoneDigits.flatMap(phoneVariants))]
  if (variants.length === 0) return { items: [] }

  const placeholders = variants.map(() => '?').join(',')
  const dateFilter = createdAfter ? 'AND created_date >= ?' : ''
  const params: (string | number)[] = [companyId, ...variants, ...variants]
  if (createdAfter) {
    params.push(createdAfter.toISOString().slice(0, 19).replace('T', ' '))
  }
  params.push(limit)

  const rows = await selectMany<SmsRow>(
    db,
    `SELECT id, cloudtalk_id,
            CAST(sender AS CHAR) AS sender,
            CAST(recipient AS CHAR) AS recipient,
            text, agent, created_date, company_id
       FROM cloudtalk_sms
      WHERE company_id = ?
        AND status IN ('received', 'sent')
        AND (sender IN (${placeholders}) OR recipient IN (${placeholders}))
        ${dateFilter}
      ORDER BY created_date DESC
      LIMIT ?`,
    params,
  )
  return { items: rows }
}
