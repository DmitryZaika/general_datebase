import type { RowDataPacket } from 'mysql2'
import type mysql from 'mysql2/promise'

export function auditDisplayName(user: { name: string }, maxLen = 100): string | null {
  const t = user.name.trim()
  if (t.length === 0) return null
  return t.length > maxLen ? t.slice(0, maxLen) : t
}

export function normalizeSalesRepId(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function fetchUserDisplayNameById(
  db: mysql.Pool,
  userId: number | null,
): Promise<string | null> {
  if (userId === null) return null
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT name FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1',
    [userId],
  )
  const row = rows[0]
  if (row === undefined || typeof row.name !== 'string') return null
  const t = row.name.trim()
  if (t.length === 0) return null
  return t
}

export async function recordCustomerReassignment(
  db: mysql.Pool,
  customerId: number,
  reassignBy: string | null,
  reassignToName: string | null,
): Promise<void> {
  const by = reassignBy?.trim()
  if (!by) return
  const toTrimmed = reassignToName?.trim()
  const to = toTrimmed && toTrimmed.length > 0 ? toTrimmed : null
  await db.execute(
    'INSERT INTO customers_history (customer_id, reassigned_by, reassigned_to) VALUES (?, ?, ?)',
    [customerId, by, to],
  )
}
