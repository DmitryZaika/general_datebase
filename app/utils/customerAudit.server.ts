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
  updatedAt?: Date | null,
): Promise<void> {
  const by = reassignBy?.trim()
  if (!by) return
  const toTrimmed = reassignToName?.trim()
  const to = toTrimmed && toTrimmed.length > 0 ? toTrimmed : null
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) {
    await db.execute(
      'INSERT INTO customers_history (customer_id, reassigned_by, reassigned_to, updated_at) VALUES (?, ?, ?, ?)',
      [customerId, by, to, updatedAt],
    )
    return
  }
  await db.execute(
    'INSERT INTO customers_history (customer_id, reassigned_by, reassigned_to) VALUES (?, ?, ?)',
    [customerId, by, to],
  )
}

const SALES_MANAGER_AUDIT_NAME = 'sales manager'

function toHistoryTimestamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return null
}

async function fetchLeadManagerAssignmentDate(
  db: mysql.Pool,
  customerId: number,
  previousRepId: number,
): Promise<Date | null> {
  const [customerRows] = await db.execute<RowDataPacket[]>(
    'SELECT assigned_date FROM customers WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [customerId],
  )
  const assignedDate = toHistoryTimestamp(customerRows[0]?.assigned_date)
  if (assignedDate) return assignedDate

  const [dealRows] = await db.execute<RowDataPacket[]>(
    `SELECT d.created_at
     FROM deals d
     WHERE d.customer_id = ? AND d.user_id = ? AND d.deleted_at IS NULL
     ORDER BY d.created_at ASC, d.id ASC
     LIMIT 1`,
    [customerId, previousRepId],
  )
  return toHistoryTimestamp(dealRows[0]?.created_at)
}

export async function isLeadWithoutCreator(
  db: mysql.Pool,
  customerId: number,
): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT source, created_by FROM customers WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [customerId],
  )
  const row = rows[0]
  if (row === undefined) return false
  const source = typeof row.source === 'string' ? row.source.trim().toLowerCase() : ''
  const createdBy = typeof row.created_by === 'string' ? row.created_by.trim() : ''
  return source === 'leads' && createdBy.length === 0
}

async function countCustomerHistory(
  db: mysql.Pool,
  customerId: number,
): Promise<number> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS c FROM customers_history WHERE customer_id = ?',
    [customerId],
  )
  const raw = rows[0]?.c
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return Number(raw) || 0
  return 0
}

export async function recordLeadManagerAssignmentBeforeReassign(
  db: mysql.Pool,
  customerId: number,
  previousRepId: number | null,
): Promise<void> {
  if (previousRepId === null) return
  const isLead = await isLeadWithoutCreator(db, customerId)
  if (!isLead) return
  const historyCount = await countCustomerHistory(db, customerId)
  if (historyCount > 0) return
  const toName = await fetchUserDisplayNameById(db, previousRepId)
  if (!toName) return
  const assignedAt = await fetchLeadManagerAssignmentDate(db, customerId, previousRepId)
  await recordCustomerReassignment(
    db,
    customerId,
    SALES_MANAGER_AUDIT_NAME,
    toName,
    assignedAt,
  )
}
