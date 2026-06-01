import { randomUUID } from 'node:crypto'
import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import { canonicalPhone10, phoneVariants } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import type { SessionUser } from '~/utils/session.server'

export type SmsDirection = 'inbound' | 'outbound'
export type SmsStatus = 'received' | 'sent' | 'failed' | 'pending'
export type SmsApiStatus = 'sent' | 'sending' | 'failed'

export interface ApiSmsMessage {
  id: string
  direction: SmsDirection
  text: string
  agent: Nullable<string>
  createdAt: string
  status: SmsApiStatus
}

export function toApiSmsMessage(row: SmsRowExpanded): ApiSmsMessage {
  return {
    id: String(row.id),
    direction: row.direction,
    text: row.text,
    agent: row.agent,
    createdAt: row.createdAt,
    status:
      row.status === 'received'
        ? 'sent'
        : row.status === 'pending'
          ? 'sending'
          : row.status,
  }
}

export interface ThreadSummaryRow {
  phoneDigits: string
  customerId: Nullable<number>
  customerName: Nullable<string>
  lastMessageText: string
  lastMessageAt: string
  lastDirection: SmsDirection
  lastAgent: Nullable<string>
  messageCount: number
  unreadCount: number
}

export interface SmsRowExpanded {
  id: number
  cloudtalkId: Nullable<number>
  direction: SmsDirection
  status: SmsStatus
  errorMessage: Nullable<string>
  text: string
  agent: Nullable<string>
  senderUserId: Nullable<number>
  createdAt: string
  sender: Nullable<string>
  recipient: string
}

export interface ListThreadsParams {
  user: SessionUser
  search: string
  limit: number
  offset: number
}

export interface ListThreadsResult {
  threads: ThreadSummaryRow[]
  totalCount: number
  unreadCount: number
  hasMore: boolean
}

export interface GetThreadParams {
  user: SessionUser
  phoneDigits: string
  limit: number
  beforeId?: string
}

export interface GetThreadResult {
  messages: SmsRowExpanded[]
  hasOlder: boolean
}

export interface MarkThreadReadParams {
  user: SessionUser
  phoneDigits: string
}

export interface InsertPendingOutboundParams {
  user: SessionUser
  phoneDigits: string
  text: string
}

export interface InsertPendingResult {
  id: number
  idempotencyKey: string
}

export interface FinalizeOutboundParams {
  id: number
  status: 'sent' | 'failed'
  cloudtalkId: Nullable<number>
  errorMessage: Nullable<string>
}

interface VisibilityClause {
  sql: string
  params: (string | number)[]
}

const PENDING_TIMEOUT_MINUTES = 5
const CLEANUP_INTERVAL_MS = 60_000

const lastCleanupAt = new Map<number, number>()

// Outbound rows are inserted as 'pending' and finalized after the CloudTalk
// call returns. If the action crashes between insert and finalize, the row
// would stay pending forever — sweep stale ones to 'failed' on read. Throttle
// per-company so active polling doesn't issue an UPDATE on every poll.
async function expireStalePendingOutbound(companyId: number): Promise<void> {
  const now = Date.now()
  const last = lastCleanupAt.get(companyId) ?? 0
  if (now - last < CLEANUP_INTERVAL_MS) return
  lastCleanupAt.set(companyId, now)
  await db.execute(
    `UPDATE cloudtalk_sms
        SET status = 'failed', error_message = 'pending_timeout'
      WHERE company_id = ?
        AND direction = 'outbound'
        AND status = 'pending'
        AND created_date < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [companyId, PENDING_TIMEOUT_MINUTES],
  )
}

// Test-only: reset the throttle so consecutive test runs don't suppress cleanup.
export function __resetPendingCleanupThrottle(): void {
  lastCleanupAt.clear()
}

// Admins/superusers see every row in their company; employees only see rows
// they participated in (matched by agent id, falling back to sender_user_id).
function buildVisibilityClause(user: SessionUser, alias: string): VisibilityClause {
  if (user.is_admin || user.is_superuser) {
    return { sql: '', params: [] }
  }
  if (user.cloudtalk_agent_id) {
    return {
      sql: ` AND (${alias}.agent = ? OR ${alias}.sender_user_id = ?)`,
      params: [user.cloudtalk_agent_id, user.id],
    }
  }
  return {
    sql: ` AND ${alias}.sender_user_id = ?`,
    params: [user.id],
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return new Date(String(value)).toISOString()
}

interface ThreadRow {
  phone_digits: string
  last_message_text: string
  last_message_at: Date | string
  last_direction: SmsDirection
  last_agent: Nullable<string>
  message_count: number
  unread_count: number
  customer_id: Nullable<number>
  customer_name: Nullable<string>
}

interface TotalCountRow {
  total_count: number
}

interface UnreadCountRow {
  unread_count: number
}

export async function listThreadsForUser(
  params: ListThreadsParams,
): Promise<ListThreadsResult> {
  const { user, search, limit, offset } = params
  await expireStalePendingOutbound(user.company_id)
  const visibility = buildVisibilityClause(user, 's')

  const searchTrimmed = search.trim()
  const searchDigits = searchTrimmed.replace(/\D+/g, '')
  const hasSearch = searchTrimmed.length > 0
  const searchClauseParts: string[] = []
  const searchParams: string[] = []
  if (hasSearch) {
    if (searchDigits.length > 0) {
      searchClauseParts.push(
        "CONVERT(CAST(CASE WHEN s.direction='inbound' THEN s.sender ELSE s.recipient END AS CHAR) USING utf8mb4) COLLATE utf8mb4_0900_ai_ci LIKE ?",
      )
      searchParams.push(`%${searchDigits}%`)
    }
    searchClauseParts.push('LOWER(s.text) LIKE ?')
    searchParams.push(`%${searchTrimmed.toLowerCase()}%`)
  }
  const searchClause = hasSearch ? ` AND (${searchClauseParts.join(' OR ')})` : ''

  const baseWhere = `s.company_id = ?${visibility.sql}${searchClause}`
  const baseParams: (string | number)[] = [
    user.company_id,
    ...visibility.params,
    ...searchParams,
  ]

  const sql = `
    WITH scoped AS (
      SELECT s.*,
        CONVERT(CAST(CASE WHEN s.direction='inbound' THEN s.sender ELSE s.recipient END AS CHAR) USING utf8mb4) COLLATE utf8mb4_0900_ai_ci AS phone_digits
      FROM cloudtalk_sms s
      WHERE ${baseWhere}
    ),
    scoped_with_reads AS (
      SELECT scoped.*, r.last_read_at
      FROM scoped
      LEFT JOIN cloudtalk_sms_thread_reads r
        ON r.user_id = ?
       AND r.company_id = ?
       AND r.customer_phone_digits = scoped.phone_digits
    ),
    latest AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY phone_digits ORDER BY created_date DESC, id DESC) AS rn
      FROM scoped_with_reads
    ),
    aggregated AS (
      SELECT phone_digits,
             COUNT(*) AS message_count,
             SUM(
               CASE
                 WHEN direction = 'inbound'
                  AND (last_read_at IS NULL OR created_date > last_read_at)
                   THEN 1
                 ELSE 0
               END
             ) AS unread_count
      FROM scoped_with_reads
      GROUP BY phone_digits
    )
    SELECT
      l.phone_digits AS phone_digits,
      l.text AS last_message_text,
      l.created_date AS last_message_at,
      l.direction AS last_direction,
      l.agent AS last_agent,
      a.message_count AS message_count,
      a.unread_count AS unread_count,
      c.id AS customer_id,
      c.name AS customer_name
    FROM latest l
    JOIN aggregated a ON a.phone_digits = l.phone_digits
    LEFT JOIN cloudtalk_contacts ct
      ON ct.company_id = ?
     AND (RIGHT(ct.phone_e164_1, 10) = RIGHT(l.phone_digits, 10)
          OR RIGHT(ct.phone_e164_2, 10) = RIGHT(l.phone_digits, 10))
    LEFT JOIN customers c
      ON c.id = ct.customer_id
     AND c.company_id = ?
     AND c.deleted_at IS NULL
    WHERE l.rn = 1
    ORDER BY l.created_date DESC, l.id DESC
    LIMIT ? OFFSET ?
  `

  const queryParams: (string | number)[] = [
    ...baseParams,
    user.id,
    user.company_id,
    user.company_id,
    user.company_id,
    limit,
    offset,
  ]

  const rows = await selectMany<ThreadRow>(db, sql, queryParams)
  // Collapse duplicate rows when two numbers share the same last-10 digits.
  const seenPhones = new Set<string>()
  const dedupedRows = rows.filter(row => {
    const key = String(row.phone_digits)
    if (seenPhones.has(key)) return false
    seenPhones.add(key)
    return true
  })

  const totalCountRows = await selectMany<TotalCountRow>(
    db,
    `SELECT COUNT(DISTINCT CONVERT(CAST(CASE WHEN s.direction='inbound' THEN s.sender ELSE s.recipient END AS CHAR) USING utf8mb4) COLLATE utf8mb4_0900_ai_ci) AS total_count
       FROM cloudtalk_sms s
      WHERE ${baseWhere}`,
    baseParams,
  )
  const totalCount = totalCountRows[0]?.total_count ?? 0

  const unreadCount = await getUnreadThreadCountForUser(user)

  const threads: ThreadSummaryRow[] = dedupedRows.map(r => ({
    phoneDigits: String(r.phone_digits),
    customerId: r.customer_id ?? null,
    customerName: r.customer_name ?? null,
    lastMessageText: r.last_message_text,
    lastMessageAt: toIsoString(r.last_message_at),
    lastDirection: r.last_direction,
    lastAgent: r.last_agent ?? null,
    messageCount: Number(r.message_count),
    unreadCount: Number(r.unread_count),
  }))

  return {
    threads,
    totalCount: Number(totalCount),
    unreadCount,
    hasMore: offset + threads.length < Number(totalCount),
  }
}

interface ThreadMessageRow {
  id: number
  cloudtalk_id: Nullable<number>
  sender: Nullable<string | number>
  recipient: string | number
  text: string
  direction: SmsDirection
  status: SmsStatus
  error_message: Nullable<string>
  agent: Nullable<string>
  sender_user_id: Nullable<number>
  created_date: Date | string
}

export async function getThreadForUser(
  params: GetThreadParams,
): Promise<GetThreadResult> {
  await expireStalePendingOutbound(params.user.company_id)
  const { user, phoneDigits, limit, beforeId } = params
  const variants = phoneVariants(phoneDigits)
  if (variants.length === 0) {
    return { messages: [], hasOlder: false }
  }

  const visibility = buildVisibilityClause(user, 's')
  const placeholders = variants.map(() => '?').join(',')
  const beforeClause = beforeId ? ' AND s.id < ?' : ''
  const sql = `
    SELECT s.id, s.cloudtalk_id,
           CAST(s.sender AS CHAR) AS sender,
           CAST(s.recipient AS CHAR) AS recipient,
           s.text, s.direction, s.status, s.error_message,
           s.agent, s.sender_user_id, s.created_date
      FROM cloudtalk_sms s
     WHERE s.company_id = ?
       AND (s.sender IN (${placeholders}) OR s.recipient IN (${placeholders}))
       ${visibility.sql}${beforeClause}
     ORDER BY s.created_date DESC, s.id DESC
     LIMIT ?
  `
  const queryParams: (string | number)[] = [
    user.company_id,
    ...variants,
    ...variants,
    ...visibility.params,
  ]
  if (beforeId) queryParams.push(Number(beforeId))
  // LIMIT N+1: fetch one extra row so we know whether older history exists
  // without issuing a second COUNT query.
  queryParams.push(limit + 1)

  const rows = await selectMany<ThreadMessageRow>(db, sql, queryParams)
  const hasOlder = rows.length > limit
  const trimmed = hasOlder ? rows.slice(0, limit) : rows

  const messages: SmsRowExpanded[] = trimmed.map(mapRowToExpanded).reverse()

  return { messages, hasOlder }
}

export async function markThreadReadForUser(
  params: MarkThreadReadParams,
): Promise<void> {
  const { user, phoneDigits } = params
  const digits = canonicalPhone10(phoneDigits)
  if (digits.length === 0) return
  await db.execute(
    `INSERT INTO cloudtalk_sms_thread_reads
       (user_id, company_id, customer_phone_digits, last_read_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
    [user.id, user.company_id, digits],
  )
}

export async function getUnreadThreadCountForUser(user: SessionUser): Promise<number> {
  const visibility = buildVisibilityClause(user, 's')
  const sql = `
    SELECT COUNT(DISTINCT CONVERT(CAST(s.sender AS CHAR) USING utf8mb4) COLLATE utf8mb4_0900_ai_ci) AS unread_count
      FROM cloudtalk_sms s
      LEFT JOIN cloudtalk_sms_thread_reads r
        ON r.user_id = ?
       AND r.company_id = s.company_id
       AND r.customer_phone_digits = CONVERT(CAST(s.sender AS CHAR) USING utf8mb4) COLLATE utf8mb4_0900_ai_ci
     WHERE s.company_id = ?
       AND s.direction = 'inbound'
       AND (r.last_read_at IS NULL OR s.created_date > r.last_read_at)
       ${visibility.sql}
  `
  const queryParams: (string | number)[] = [
    user.id,
    user.company_id,
    ...visibility.params,
  ]
  const rows = await selectMany<UnreadCountRow>(db, sql, queryParams)
  return Number(rows[0]?.unread_count ?? 0)
}

// Unread inbound count for one thread — drives the mark-read trigger.
export async function getThreadUnreadCountForUser(
  user: SessionUser,
  phoneDigits: string,
): Promise<number> {
  const digits = canonicalPhone10(phoneDigits)
  if (digits.length === 0) return 0
  const visibility = buildVisibilityClause(user, 's')
  const variants = phoneVariants(digits)
  const placeholders = variants.map(() => '?').join(',')
  const rows = await selectMany<UnreadCountRow>(
    db,
    `SELECT COUNT(*) AS unread_count
       FROM cloudtalk_sms s
       LEFT JOIN cloudtalk_sms_thread_reads r
         ON r.user_id = ?
        AND r.company_id = s.company_id
        AND r.customer_phone_digits = ?
      WHERE s.company_id = ?
        AND s.direction = 'inbound'
        AND s.sender IN (${placeholders})
        AND (r.last_read_at IS NULL OR s.created_date > r.last_read_at)
        ${visibility.sql}`,
    [user.id, digits, user.company_id, ...variants, ...visibility.params],
  )
  return Number(rows[0]?.unread_count ?? 0)
}

export async function fetchCustomerByPhone(
  companyId: number,
  phoneDigits: string,
): Promise<Nullable<{ id: number; name: string }>> {
  const rows = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT c.id, c.name
       FROM customers c
       JOIN cloudtalk_contacts cc ON cc.customer_id = c.id
      WHERE cc.company_id = ?
        AND (RIGHT(cc.phone_e164_1, 10) = RIGHT(?, 10)
          OR RIGHT(cc.phone_e164_2, 10) = RIGHT(?, 10))
      LIMIT 1`,
    [companyId, phoneDigits, phoneDigits],
  )
  return rows[0] ?? null
}

function mapRowToExpanded(r: ThreadMessageRow): SmsRowExpanded {
  return {
    id: Number(r.id),
    cloudtalkId: r.cloudtalk_id ?? null,
    direction: r.direction,
    status: r.status,
    errorMessage: r.error_message ?? null,
    text: r.text,
    agent: r.agent ?? null,
    senderUserId: r.sender_user_id ?? null,
    createdAt: toIsoString(r.created_date),
    sender: r.sender === null || r.sender === undefined ? null : String(r.sender),
    recipient: String(r.recipient),
  }
}

export async function insertPendingOutboundSms(
  params: InsertPendingOutboundParams,
): Promise<InsertPendingResult> {
  const { user, phoneDigits, text } = params
  const digits = canonicalPhone10(phoneDigits)
  const idempotencyKey = randomUUID()
  const [result] = await db.execute(
    `INSERT INTO cloudtalk_sms
       (cloudtalk_id, sender, recipient, text, direction, status, error_message,
        idempotency_key, agent, sender_user_id, company_id, created_date)
     VALUES (NULL, NULL, ?, ?, 'outbound', 'pending', NULL, ?, ?, ?, ?, NOW())`,
    [digits, text, idempotencyKey, user.cloudtalk_agent_id, user.id, user.company_id],
  )
  const insertId = (result as { insertId: number }).insertId
  return { id: insertId, idempotencyKey }
}

export async function finalizeOutboundSms(
  params: FinalizeOutboundParams,
): Promise<SmsRowExpanded> {
  const { id, status, cloudtalkId, errorMessage } = params
  await db.execute(
    `UPDATE cloudtalk_sms
        SET status = ?, cloudtalk_id = ?, error_message = ?
      WHERE id = ?`,
    [status, cloudtalkId, errorMessage, id],
  )
  const rows = await selectMany<ThreadMessageRow>(
    db,
    `SELECT id, cloudtalk_id, direction, status, error_message, text,
            agent, sender_user_id, created_date,
            CAST(sender AS CHAR) AS sender,
            CAST(recipient AS CHAR) AS recipient
       FROM cloudtalk_sms WHERE id = ?`,
    [id],
  )
  const row = rows[0]
  if (!row) throw new Error('outbound_row_missing_after_update')
  return mapRowToExpanded(row)
}

export async function userHasMessagesForPhone(
  user: SessionUser,
  phoneDigits: string,
): Promise<boolean> {
  const visibility = buildVisibilityClause(user, 's')
  const variants = phoneVariants(phoneDigits)
  if (variants.length === 0) return false
  const placeholders = variants.map(() => '?').join(',')
  const rows = await selectMany<{ found: number }>(
    db,
    `SELECT 1 AS found FROM cloudtalk_sms s
      WHERE s.company_id = ?${visibility.sql}
        AND (s.sender IN (${placeholders}) OR s.recipient IN (${placeholders}))
      LIMIT 1`,
    [user.company_id, ...visibility.params, ...variants, ...variants],
  )
  return rows.length > 0
}
