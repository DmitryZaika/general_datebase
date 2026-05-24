import { data, type LoaderFunctionArgs } from 'react-router'
import { z } from 'zod'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

const schema = z.object({
  term: z.string().trim().min(1),
})

type RecipientCustomer = {
  id: number
  name: string
  email: string
  company_name: string | null
}

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

function emailLocalPart(email: string) {
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
}

function matchesEmailFuzzy(email: string, term: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedTerm = term.trim().toLowerCase()
  if (!normalizedTerm) return false
  if (normalizedEmail.includes(normalizedTerm)) return true
  if (levenshtein(normalizedEmail, normalizedTerm) <= 1) return true

  const emailLocal = emailLocalPart(normalizedEmail)
  const termAt = normalizedTerm.indexOf('@')

  if (termAt < 0) {
    if (emailLocal.startsWith(normalizedTerm)) return true
    if (normalizedTerm.startsWith(emailLocal)) return true
    if (levenshtein(emailLocal, normalizedTerm) <= 1) return true
    if (emailLocal.length >= normalizedTerm.length - 1 && normalizedTerm.length > 0) {
      return (
        levenshtein(emailLocal.slice(0, normalizedTerm.length), normalizedTerm) <= 1
      )
    }
    return false
  }

  const emailAt = normalizedEmail.indexOf('@')
  if (emailAt <= 0) return false

  const emailDomain = normalizedEmail.slice(emailAt + 1)
  const termDomain = normalizedTerm.slice(termAt + 1)
  if (emailDomain !== termDomain) return false

  const termLocal = normalizedTerm.slice(0, termAt)
  return levenshtein(emailLocal, termLocal) <= 1
}

function rankRecipient(customer: RecipientCustomer, term: string) {
  const normalizedTerm = term.toLowerCase()
  const normalizedEmail = customer.email.toLowerCase()
  const localPart = emailLocalPart(normalizedEmail)
  if (normalizedEmail.startsWith(normalizedTerm)) return 0
  if (localPart.startsWith(normalizedTerm)) return 0
  if (matchesEmailFuzzy(customer.email, term)) return 1
  if (customer.name.toLowerCase().includes(normalizedTerm)) return 2
  if (customer.company_name?.toLowerCase().includes(normalizedTerm)) return 3
  return 4
}

function dedupeCustomers(customers: RecipientCustomer[]) {
  return customers.filter((customer, index, array) => {
    return array.findIndex(item => item.email === customer.email) === index
  })
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const url = new URL(request.url)

  const parsed = schema.safeParse({
    term: url.searchParams.get('term') || '',
  })

  if (!parsed.success) {
    return data({ customers: [] })
  }

  const term = parsed.data.term
  const prefix = `${term}%`
  const like = `%${term}%`

  const exactMatches = await selectMany<RecipientCustomer>(
    db,
    `SELECT c.id, c.name, c.email, c.company_name
     FROM customers c
     WHERE c.company_id = ?
       AND c.deleted_at IS NULL
       AND c.email IS NOT NULL
       AND c.email != ''
       AND (
         c.name LIKE ?
         OR c.email LIKE ?
         OR (c.company_name IS NOT NULL AND c.company_name LIKE ?)
       )
     ORDER BY
       CASE
         WHEN c.email LIKE ? THEN 0
         WHEN c.name LIKE ? THEN 1
         WHEN c.company_name LIKE ? THEN 2
         ELSE 3
       END,
       c.name ASC
     LIMIT 15`,
    [user.company_id, like, like, like, prefix, prefix, prefix],
  )

  let customers = exactMatches

  const atIndex = term.indexOf('@')
  if (atIndex > 0) {
    const domain = term.slice(atIndex + 1).toLowerCase()
    if (domain.length > 0) {
      const domainMatches = await selectMany<RecipientCustomer>(
        db,
        `SELECT c.id, c.name, c.email, c.company_name
         FROM customers c
         WHERE c.company_id = ?
           AND c.deleted_at IS NULL
           AND c.email IS NOT NULL
           AND c.email != ''
           AND LOWER(c.email) LIKE ?
         LIMIT 50`,
        [user.company_id, `%@${domain}`],
      )

      customers = dedupeCustomers([...exactMatches, ...domainMatches])
    }
  } else if (term.length >= 3) {
    const fuzzyPrefix =
      term.length > 3 ? term.slice(0, term.length - 1) : term.slice(0, 3)
    const localPartMatches = await selectMany<RecipientCustomer>(
      db,
      `SELECT c.id, c.name, c.email, c.company_name
       FROM customers c
       WHERE c.company_id = ?
         AND c.deleted_at IS NULL
         AND c.email IS NOT NULL
         AND c.email != ''
         AND LOWER(SUBSTRING_INDEX(c.email, '@', 1)) LIKE ?
       LIMIT 50`,
      [user.company_id, `${fuzzyPrefix.toLowerCase()}%`],
    )

    customers = dedupeCustomers([...exactMatches, ...localPartMatches])
  }

  customers = customers.filter(
    customer =>
      customer.name.toLowerCase().includes(term.toLowerCase()) ||
      customer.email.toLowerCase().includes(term.toLowerCase()) ||
      customer.company_name?.toLowerCase().includes(term.toLowerCase()) ||
      matchesEmailFuzzy(customer.email, term),
  )

  const uniqueCustomers = dedupeCustomers(customers)
    .sort((a, b) => {
      const rankDiff = rankRecipient(a, term) - rankRecipient(b, term)
      if (rankDiff !== 0) return rankDiff
      return a.name.localeCompare(b.name)
    })
    .slice(0, 15)

  return data({ customers: uniqueCustomers })
}
