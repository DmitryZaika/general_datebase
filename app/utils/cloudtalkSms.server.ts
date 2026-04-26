import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import type { SmsRow } from '~/utils/smsDisplayHelpers'

export interface FetchSmsParams {
  companyId: number
  phoneDigits: string[]
  createdAfter?: Date
  limit?: number
}

export function cloudTalkSmsPhoneVariants(phoneDigits: string[]): string[] {
  return [
    ...new Set(
      phoneDigits.flatMap(digits => {
        if (digits.length === 11 && digits.startsWith('1')) {
          return [digits, digits.slice(1)]
        }
        if (digits.length === 10) {
          return [digits, `1${digits}`]
        }
        return [digits]
      }),
    ),
  ]
}

export async function fetchSmsForCompanyAndPhones({
  phoneDigits,
  createdAfter,
  limit = 200,
}: FetchSmsParams): Promise<{ items: SmsRow[] }> {
  const phoneVariants = cloudTalkSmsPhoneVariants(phoneDigits)
  if (phoneVariants.length === 0) return { items: [] }

  const placeholders = phoneVariants.map(() => '?').join(',')
  const dateFilter = createdAfter ? 'AND created_date >= ?' : ''
  const params: (string | number)[] = [...phoneVariants, ...phoneVariants]
  if (createdAfter) {
    params.push(createdAfter.toISOString().slice(0, 19).replace('T', ' '))
  }
  params.push(limit)

  const rows = await selectMany<SmsRow>(
    db,
    `SELECT id, cloudtalk_id,
            CAST(sender AS CHAR) AS sender,
            CAST(recipient AS CHAR) AS recipient,
            text, agent, created_date, NULL AS company_id
       FROM cloudtalk_sms
      WHERE (sender IN (${placeholders}) OR recipient IN (${placeholders}))
        ${dateFilter}
      ORDER BY created_date DESC
      LIMIT ?`,
    params,
  )
  return { items: rows }
}
