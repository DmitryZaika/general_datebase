import { data, type LoaderFunctionArgs } from 'react-router'
import z from 'zod'
import { db } from '~/db.server'
import type { Customer } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

function levenshtein(a: string, b: string) {
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

function matchesNameFuzzy(name: string, term: string) {
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

export const customerSchema = z.object({
  term: z.string(),
  searchType: z.enum(['name', 'phone', 'email']).prefault('name'),
})

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const url = new URL(request.url)
  const customerData = {
    term: url.searchParams.get('term'),
    searchType: url.searchParams.get('searchType') || 'name',
  }
  let term: string
  let searchType: 'name' | 'phone' | 'email'
  try {
    ;({ term, searchType } = customerSchema.parse(customerData))
  } catch {
    return data({ error: 'Invalid search parameters' }, { status: 422 })
  }

  try {
    const like = `%${term}%`
    const prefixLike = `${term}%`
    const prefetchedLimit = 100

    let customers: Customer[] = []

    if (searchType === 'name') {
      const words = term
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0)

      let nameCondition = 'c.name LIKE ?'
      const nameParams: string[] = []

      if (words.length > 1) {
        const parts = words.map(() => 'c.name LIKE ?').join(' AND ')
        nameCondition = `(c.name LIKE ? OR (${parts}))`
        const phrase = `%${words.join(' ')}%`
        const wordParams = words.map(w => {
          const base = w.length >= 3 ? w.slice(0, 3) : w
          return `%${base}%`
        })
        nameParams.push(phrase, ...wordParams)
      } else {
        const base = term.trim()
        const short = base.length >= 3 ? base.slice(0, 3) : base
        nameParams.push(`%${short}%`)
      }

      customers = await selectMany<Customer>(
        db,
        `SELECT DISTINCT c.id, c.name, c.address, c.phone, c.phone_2, c.email, c.company_name
         FROM customers c
         LEFT JOIN deals d ON d.customer_id = c.id AND d.user_id = ? AND d.deleted_at IS NULL
         WHERE c.company_id = ? AND c.deleted_at IS NULL
           AND ${nameCondition}
         ORDER BY
           CASE
             WHEN d.id IS NOT NULL THEN 0
             WHEN c.sales_rep = ? THEN 1
             ELSE 2
           END,
           CASE
             WHEN c.name LIKE ? THEN 0
             WHEN c.name LIKE ? THEN 1
             ELSE 2
           END,
           c.name ASC
         LIMIT ${prefetchedLimit}`,
        [user.id, user.company_id, ...nameParams, user.id, prefixLike, like],
      )
    } else if (searchType === 'phone') {
      const digits = term.replace(/\D/g, '')
      const last10 = digits.length > 10 ? digits.slice(-10) : digits
      const phoneExpr =
        "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone,'-',''),' ',''),'(',''),')',''),'+',''),'.','')"
      const phone2Expr =
        "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone_2,'-',''),' ',''),'(',''),')',''),'+',''),'.','')"

      if (!digits) {
        customers = await selectMany<Customer>(
          db,
          `SELECT DISTINCT c.id, c.name, c.address, c.phone, c.phone_2, c.email, c.company_name
           FROM customers c
           LEFT JOIN deals d ON d.customer_id = c.id AND d.user_id = ? AND d.deleted_at IS NULL
           WHERE c.company_id = ? AND c.deleted_at IS NULL
             AND (c.phone LIKE ? OR c.phone_2 LIKE ?)
           ORDER BY
             CASE
               WHEN d.id IS NOT NULL THEN 0
               WHEN c.sales_rep = ? THEN 1
               ELSE 2
             END,
             CASE
               WHEN c.phone LIKE ? OR c.phone_2 LIKE ? THEN 0
               WHEN c.phone LIKE ? OR c.phone_2 LIKE ? THEN 1
               ELSE 2
             END,
             c.name ASC
           LIMIT 15`,
          [
            user.id,
            user.company_id,
            like,
            like,
            user.id,
            prefixLike,
            prefixLike,
            like,
            like,
          ],
        )
      } else {
        const likeDigits = `%${digits}%`
        const prefixDigits = `${digits}%`
        const likeLast10 = `%${last10}%`
        const prefixLast10 = `${last10}%`

        customers = await selectMany<Customer>(
          db,
          `SELECT DISTINCT c.id, c.name, c.address, c.phone, c.phone_2, c.email, c.company_name
           FROM customers c
           LEFT JOIN deals d ON d.customer_id = c.id AND d.user_id = ? AND d.deleted_at IS NULL
           WHERE c.company_id = ? AND c.deleted_at IS NULL
             AND (${phoneExpr} LIKE ? OR ${phoneExpr} LIKE ? OR ${phone2Expr} LIKE ? OR ${phone2Expr} LIKE ?)
           ORDER BY
             CASE
               WHEN d.id IS NOT NULL THEN 0
               WHEN c.sales_rep = ? THEN 1
               ELSE 2
             END,
             CASE
               WHEN ${phoneExpr} LIKE ? OR ${phoneExpr} LIKE ? OR ${phone2Expr} LIKE ? OR ${phone2Expr} LIKE ? THEN 0
               WHEN ${phoneExpr} LIKE ? OR ${phoneExpr} LIKE ? OR ${phone2Expr} LIKE ? OR ${phone2Expr} LIKE ? THEN 1
               ELSE 2
             END,
             c.name ASC
           LIMIT 15`,
          [
            user.id,
            user.company_id,
            likeDigits,
            likeLast10,
            likeDigits,
            likeLast10,
            user.id,
            prefixDigits,
            prefixLast10,
            prefixDigits,
            prefixLast10,
            likeDigits,
            likeLast10,
            likeDigits,
            likeLast10,
          ],
        )
      }
    } else {
      customers = await selectMany<Customer>(
        db,
        `SELECT DISTINCT c.id, c.name, c.address, c.phone, c.phone_2, c.email, c.company_name
         FROM customers c
         LEFT JOIN deals d ON d.customer_id = c.id AND d.user_id = ? AND d.deleted_at IS NULL
         WHERE c.company_id = ? AND c.deleted_at IS NULL
           AND ?? LIKE ?
         ORDER BY
           CASE
             WHEN d.id IS NOT NULL THEN 0
             WHEN c.sales_rep = ? THEN 1
             ELSE 2
           END,
           CASE
             WHEN ?? LIKE ? THEN 0
             WHEN ?? LIKE ? THEN 1
             ELSE 2
           END,
           c.name ASC
         LIMIT 15`,
        [
          user.id,
          user.company_id,
          searchType,
          like,
          user.id,
          searchType,
          prefixLike,
          searchType,
          like,
        ],
      )
    }

    if (searchType === 'name') {
      customers = customers.filter(c => matchesNameFuzzy(c.name, term)).slice(0, 15)
    }

    return data({ customers })
  } catch {
    return data({ error: 'Failed to search customers' }, { status: 500 })
  }
}
