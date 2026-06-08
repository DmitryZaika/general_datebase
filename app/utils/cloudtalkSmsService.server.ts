import { randomUUID } from 'node:crypto'
import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import { canonicalPhone10, phoneVariants } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import type { SessionUser } from '~/utils/session.server'
import { inferSmsDirection } from '~/utils/smsDisplayHelpers'

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

const PENDING_TIMEOUT_MINUTES = 5
const CLEANUP_INTERVAL_MS = 60_000

const lastCleanupAt = new Map<number, number>()

// Sweep outbound rows stuck in 'pending' (action crashed between insert and finalize)
// to 'failed' on read. Throttled per-company so polling doesn't UPDATE every time.
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

// Any user with a linked CloudTalk agent may send; without one it's read-only.
export function canUserSendSms(user: SessionUser): boolean {
  return Boolean(user.cloudtalk_agent_id)
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
  last_sender: Nullable<string>
  last_agent: Nullable<string>
  message_count: number
  unread_count: number
  customer_id: Nullable<number>
  customer_name: Nullable<string>
}

function userAgentId(user: SessionUser): string | null {
  const agentId = user.cloudtalk_agent_id?.trim() ?? ''
  return agentId.length > 0 ? agentId : null
}

function agentScopeClause(
  user: SessionUser,
  alias: string,
): { clause: string; params: (string | number)[] } {
  const agentId = userAgentId(user)
  if (!agentId) {
    return { clause: '1 = 0', params: [] }
  }
  return {
    clause: `(
      TRIM(IFNULL(${alias}.agent, '')) = ?
      OR (
        TRIM(IFNULL(${alias}.agent, '')) = ''
        AND EXISTS (
          SELECT 1 FROM cloudtalk_sms link
          WHERE link.company_id = ${alias}.company_id
            AND TRIM(IFNULL(link.agent, '')) = ?
            AND (
              CAST(link.recipient AS CHAR) = CAST(${alias}.sender AS CHAR)
              OR CAST(link.sender AS CHAR) = CAST(${alias}.sender AS CHAR)
            )
        )
      )
    )`,
    params: [agentId, agentId],
  }
}

const COMPANY_SENDER_SUBQUERY = `(
  SELECT DISTINCT CAST(s2.sender AS CHAR) AS phone
  FROM cloudtalk_sms s2
  WHERE s2.company_id = s.company_id
    AND s2.agent IS NOT NULL
    AND TRIM(s2.agent) != ''
    AND s2.sender IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM cloudtalk_sms c
      WHERE c.company_id = s2.company_id
        AND c.direction = 'inbound'
        AND (c.agent IS NULL OR TRIM(c.agent) = '')
        AND CAST(c.recipient AS CHAR) = CAST(s2.sender AS CHAR)
    )
)`

const CUSTOMER_PHONE_SQL = `CONVERT(CAST(
  CASE
    WHEN s.direction = 'outbound' THEN s.recipient
    WHEN s.sender IN ${COMPANY_SENDER_SUBQUERY} THEN s.recipient
    ELSE s.sender
  END
AS CHAR) USING utf8mb4) COLLATE utf8mb4_0900_ai_ci`

const COMPANY_LINE_EXCLUSION = `${CUSTOMER_PHONE_SQL} NOT IN ${COMPANY_SENDER_SUBQUERY}`

const OUTBOUND_ECHO_EXCLUSION = `NOT (
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

  const searchTrimmed = search.trim()
  const searchDigits = searchTrimmed.replace(/\D+/g, '')
  const hasSearch = searchTrimmed.length > 0
  const searchClauseParts: string[] = []
  const searchParams: string[] = []
  if (hasSearch) {
    if (searchDigits.length > 0) {
      searchClauseParts.push(`${CUSTOMER_PHONE_SQL} LIKE ?`)
      searchParams.push(`%${searchDigits}%`)
    }
    searchClauseParts.push('LOWER(s.text) LIKE ?')
    searchParams.push(`%${searchTrimmed.toLowerCase()}%`)
  }
  const searchClause = hasSearch ? ` AND (${searchClauseParts.join(' OR ')})` : ''

  const agentScope = agentScopeClause(user, 's')
  const baseWhere = `s.company_id = ?${searchClause} AND ${OUTBOUND_ECHO_EXCLUSION} AND ${COMPANY_LINE_EXCLUSION} AND ${agentScope.clause}`
  const baseParams: (string | number)[] = [
    user.company_id,
    ...searchParams,
    ...agentScope.params,
  ]

  const sql = `
    WITH scoped AS (
      SELECT s.*,
        ${CUSTOMER_PHONE_SQL} AS phone_digits
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
                 WHEN CAST(sender AS CHAR) = phone_digits
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
      CAST(l.sender AS CHAR) AS last_sender,
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
    `SELECT COUNT(DISTINCT ${CUSTOMER_PHONE_SQL}) AS total_count
       FROM cloudtalk_sms s
      WHERE ${baseWhere}`,
    baseParams,
  )
  const totalCount = totalCountRows[0]?.total_count ?? 0

  const unreadCount = await getUnreadThreadCountForUser(user)

  const threads: ThreadSummaryRow[] = dedupedRows.map(r => {
    const phoneDigits = String(r.phone_digits)
    return {
      phoneDigits,
      customerId: r.customer_id ?? null,
      customerName: r.customer_name ?? null,
      lastMessageText: r.last_message_text,
      lastMessageAt: toIsoString(r.last_message_at),
      lastDirection: inferSmsDirection(r.last_sender, phoneVariants(phoneDigits)),
      lastAgent: r.last_agent ?? null,
      messageCount: Number(r.message_count),
      unreadCount: Number(r.unread_count),
    }
  })

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

  const hasAccess = await userHasMessagesForPhone(user, phoneDigits)
  if (!hasAccess) {
    return { messages: [], hasOlder: false }
  }

  const agentScope = agentScopeClause(user, 's')
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
       AND NOT (s.direction = 'outbound' AND s.status IN ('pending', 'failed'))
       AND ${OUTBOUND_ECHO_EXCLUSION}
       AND ${agentScope.clause}
       ${beforeClause}
     ORDER BY s.created_date DESC, s.id DESC
     LIMIT ?
  `
  const queryParams: (string | number)[] = [
    user.company_id,
    ...variants,
    ...variants,
    ...agentScope.params,
  ]
  if (beforeId) queryParams.push(Number(beforeId))
  // LIMIT N+1: fetch one extra row so we know whether older history exists
  // without issuing a second COUNT query.
  queryParams.push(limit + 1)

  const rows = await selectMany<ThreadMessageRow>(db, sql, queryParams)
  const hasOlder = rows.length > limit
  const trimmed = hasOlder ? rows.slice(0, limit) : rows

  const customerVariants = phoneVariants(phoneDigits)
  const messages: SmsRowExpanded[] = trimmed
    .map(row => {
      const expanded = mapRowToExpanded(row)
      return {
        ...expanded,
        direction: inferSmsDirection(expanded.sender, customerVariants),
      }
    })
    .reverse()

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
  const agentScope = agentScopeClause(user, 's')
  const sql = `
    SELECT COUNT(DISTINCT ${CUSTOMER_PHONE_SQL}) AS unread_count
      FROM cloudtalk_sms s
      LEFT JOIN cloudtalk_sms_thread_reads r
        ON r.user_id = ?
       AND r.company_id = s.company_id
       AND r.customer_phone_digits = ${CUSTOMER_PHONE_SQL}
     WHERE s.company_id = ?
       AND s.direction = 'inbound'
       AND ${OUTBOUND_ECHO_EXCLUSION}
       AND (s.agent IS NULL OR TRIM(s.agent) = '')
       AND s.sender NOT IN ${COMPANY_SENDER_SUBQUERY}
       AND ${agentScope.clause}
       AND (r.last_read_at IS NULL OR s.created_date > r.last_read_at)
  `
  const queryParams: (string | number)[] = [
    user.id,
    user.company_id,
    ...agentScope.params,
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
  const variants = phoneVariants(digits)
  const placeholders = variants.map(() => '?').join(',')
  const agentScope = agentScopeClause(user, 's')
  const rows = await selectMany<UnreadCountRow>(
    db,
    `SELECT COUNT(*) AS unread_count
       FROM cloudtalk_sms s
       LEFT JOIN cloudtalk_sms_thread_reads r
         ON r.user_id = ?
        AND r.company_id = s.company_id
        AND r.customer_phone_digits = ?
      WHERE s.company_id = ?
        AND s.sender IN (${placeholders})
        AND ${agentScope.clause}
        AND (r.last_read_at IS NULL OR s.created_date > r.last_read_at)`,
    [user.id, digits, user.company_id, ...variants, ...agentScope.params],
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
        AND c.deleted_at IS NULL
        AND (RIGHT(cc.phone_e164_1, 10) = RIGHT(?, 10)
          OR RIGHT(cc.phone_e164_2, 10) = RIGHT(?, 10))
      LIMIT 1`,
    [companyId, phoneDigits, phoneDigits],
  )
  if (rows[0]) return rows[0]

  // Fallback when the customer isn't in cloudtalk_contacts yet: match the free-text
  // customers.phone / phone_2 by last-10 digits.
  const direct = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT c.id, c.name
       FROM customers c
      WHERE c.company_id = ?
        AND c.deleted_at IS NULL
        AND (RIGHT(REGEXP_REPLACE(COALESCE(c.phone, ''), '[^0-9]', ''), 10) = RIGHT(?, 10)
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.phone_2, ''), '[^0-9]', ''), 10) = RIGHT(?, 10))
      LIMIT 1`,
    [companyId, phoneDigits, phoneDigits],
  )
  return direct[0] ?? null
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
  const variants = phoneVariants(phoneDigits)
  if (variants.length === 0) return false
  const agentScope = agentScopeClause(user, 's')
  const placeholders = variants.map(() => '?').join(',')
  const rows = await selectMany<{ found: number }>(
    db,
    `SELECT 1 AS found FROM cloudtalk_sms s
      WHERE s.company_id = ?
        AND (s.sender IN (${placeholders}) OR s.recipient IN (${placeholders}))
        AND ${agentScope.clause}
      LIMIT 1`,
    [user.company_id, ...variants, ...variants, ...agentScope.params],
  )
  return rows.length > 0
}
