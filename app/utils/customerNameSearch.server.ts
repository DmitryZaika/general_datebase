import { db } from '~/db.server'
import { canonicalPhone10 } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const aLen = a.length
  const bLen = b.length
  if (aLen === 0) return bLen
  if (bLen === 0) return aLen
  const dp: number[] = []
  for (let i = 0; i <= bLen; i++) dp[i] = i
  for (let i = 1; i <= aLen; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= bLen; j++) {
      const temp = dp[j]
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev
      } else {
        const min = dp[j] < dp[j - 1] ? dp[j] : dp[j - 1]
        dp[j] = (prev < min ? prev : min) + 1
      }
      prev = temp
    }
  }
  return dp[bLen]
}

export function matchesNameFuzzy(name: string, term: string): boolean {
  const normalizedName = name.toLowerCase()
  const normalizedTerm = term.toLowerCase().trim()
  if (!normalizedTerm) return true
  const termWords = normalizedTerm.split(/\s+/).filter(w => w.length > 0)
  if (termWords.length === 0) return true
  const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 0)
  return termWords.every(tw => {
    if (normalizedName.includes(tw)) return true
    return nameWords.some(nw => levenshtein(nw, tw) <= 1)
  })
}

export function buildNameSearchLikeClause(
  term: string,
  nameColumn = 'name',
  companyNameColumn = 'company_name',
): { clause: string; params: string[] } {
  const trimmed = term.trim()
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  const like = `%${trimmed}%`
  const prefixLike = `${trimmed}%`
  const companyCondition = `(${companyNameColumn} IS NOT NULL AND ${companyNameColumn} != '' AND (${companyNameColumn} LIKE ? OR ${companyNameColumn} LIKE ?))`

  if (words.length > 1) {
    const parts = words.map(() => `${nameColumn} LIKE ?`).join(' AND ')
    const phrase = `%${words.join(' ')}%`
    const wordParams = words.map(w => {
      const base = w.length >= 3 ? w.slice(0, 3) : w
      return `%${base}%`
    })
    return {
      clause: `(${nameColumn} LIKE ? OR (${parts}) OR ${companyCondition})`,
      params: [phrase, ...wordParams, prefixLike, like],
    }
  }

  const base = trimmed
  const short = base.length >= 3 ? base.slice(0, 3) : base
  return {
    clause: `(${nameColumn} LIKE ? OR ${companyCondition})`,
    params: [`%${short}%`, prefixLike, like],
  }
}

export interface CustomerNameRow {
  id: number
  name: string
  company_name: string | null
  phone: string | null
  phone_2: string | null
}

function phoneLast10(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = canonicalPhone10(phone)
  return digits.length >= 10 ? digits : null
}

export async function findCustomersByFuzzyName(
  companyId: number,
  term: string,
  limit = 100,
): Promise<CustomerNameRow[]> {
  const trimmed = term.trim()
  if (trimmed.length < 2) return []

  const { clause, params } = buildNameSearchLikeClause(trimmed)
  const rows = await selectMany<CustomerNameRow>(
    db,
    `SELECT id, name, company_name, phone, phone_2
       FROM customers
      WHERE company_id = ?
        AND deleted_at IS NULL
        AND ${clause}
      ORDER BY name ASC
      LIMIT ?`,
    [companyId, ...params, limit],
  )

  return rows.filter(
    c =>
      matchesNameFuzzy(c.name, trimmed) ||
      matchesNameFuzzy(c.company_name ?? '', trimmed),
  )
}

export async function findThreadPhoneDigitsByCustomerName(
  companyId: number,
  term: string,
): Promise<string[]> {
  const customers = await findCustomersByFuzzyName(companyId, term)
  if (customers.length === 0) return []

  const digitsSet = new Set<string>()
  for (const customer of customers) {
    const phone = phoneLast10(customer.phone)
    const phone2 = phoneLast10(customer.phone_2)
    if (phone) digitsSet.add(phone)
    if (phone2) digitsSet.add(phone2)
  }

  const customerIds = customers.map(c => c.id)
  if (customerIds.length > 0) {
    const placeholders = customerIds.map(() => '?').join(',')
    const contacts = await selectMany<{
      phone_e164_1: string | null
      phone_e164_2: string | null
    }>(
      db,
      `SELECT phone_e164_1, phone_e164_2
         FROM cloudtalk_contacts
        WHERE company_id = ?
          AND customer_id IN (${placeholders})`,
      [companyId, ...customerIds],
    )
    for (const contact of contacts) {
      const phone = phoneLast10(contact.phone_e164_1)
      const phone2 = phoneLast10(contact.phone_e164_2)
      if (phone) digitsSet.add(phone)
      if (phone2) digitsSet.add(phone2)
    }
  }

  return [...digitsSet]
}
