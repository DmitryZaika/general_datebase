import { db } from '~/db.server'
import { phoneVariants } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import type { SmsRow } from '~/utils/smsDisplayHelpers'

export const OUTBOUND_ECHO_EXCLUSION = `NOT (
  s.direction = 'inbound'
  AND (s.agent IS NULL OR TRIM(s.agent) = '')
  AND EXISTS (
    SELECT 1 FROM cloudtalk_sms o
    WHERE o.company_id = s.company_id
      AND o.direction = 'outbound'
      AND o.status = 'sent'
      AND o.text = s.text
      AND CAST(o.recipient AS CHAR) = CAST(s.recipient AS CHAR)
      AND ABS(TIMESTAMPDIFF(SECOND, o.created_date, s.created_date)) <= 300
  )
)`

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
  const dateFilter = createdAfter ? 'AND s.created_date >= ?' : ''
  const params: (string | number)[] = [companyId, ...variants, ...variants]
  if (createdAfter) {
    params.push(createdAfter.toISOString().slice(0, 19).replace('T', ' '))
  }
  params.push(limit)

  const rows = await selectMany<SmsRow>(
    db,
    `SELECT s.id, s.cloudtalk_id,
            CAST(s.sender AS CHAR) AS sender,
            CAST(s.recipient AS CHAR) AS recipient,
            s.text, s.agent, s.created_date, s.company_id
       FROM cloudtalk_sms s
      WHERE s.company_id = ?
        AND s.status IN ('received', 'sent')
        AND (s.sender IN (${placeholders}) OR s.recipient IN (${placeholders}))
        AND ${OUTBOUND_ECHO_EXCLUSION}
        ${dateFilter}
      ORDER BY s.created_date DESC
      LIMIT ?`,
    params,
  )
  return { items: rows }
}
