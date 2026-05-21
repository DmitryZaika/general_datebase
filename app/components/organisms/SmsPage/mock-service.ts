// Mock service. Mirrors the future server API so components can be swapped to
// real `fetch()` in iteration 3 without edits. State is in-process; refreshing
// the page resets to the initial fixtures.

import {
  buildThreadSummary,
  MOCK_AGENT_NAME,
  MOCK_CUSTOMERS,
  MOCK_THREADS,
} from './mock-data'
import type {
  MockCustomer,
  ScopeFilter,
  SessionContext,
  SmsMessage,
  SmsThread,
  ThreadSummary,
} from './types'

// Sending to this number simulates a CloudTalk 500 — used to demo the failed-send UX.
const FAIL_PHONE_DIGITS = '6175557777'

const state = {
  threads: structuredClone(MOCK_THREADS) as SmsThread[],
  customers: structuredClone(MOCK_CUSTOMERS) as MockCustomer[],
}

const subscribers = new Set<() => void>()

function notify() {
  for (const fn of subscribers) fn()
}

export function subscribe(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function jitter(base: number) {
  return base + Math.random() * 60
}

export const MOCK_SESSION: SessionContext = {
  userId: 1,
  isAdmin: true,
  isAgentLinked: true,
  displayName: MOCK_AGENT_NAME,
}

export async function fetchThreads(params: {
  scope: ScopeFilter
  search: string
  limit: number
  offset: number
}): Promise<{
  threads: ThreadSummary[]
  totalCount: number
  unreadCount: number
  hasMore: boolean
}> {
  await delay(jitter(80))

  const all = state.threads
  const scoped =
    params.scope === 'mine' ? all.filter(t => t.assignedToCurrentUser) : all

  const lower = params.search.trim().toLowerCase()
  const digits = lower.replace(/\D+/g, '')

  const filtered = lower
    ? scoped.filter(t => {
        if (digits && t.phoneDigits.includes(digits)) return true
        if (t.customer?.name.toLowerCase().includes(lower)) return true
        // Search across every message body, not just the latest — matches the
        // expectation that "search messages" means full-text within the thread.
        return t.messages.some(m => m.text.toLowerCase().includes(lower))
      })
    : scoped

  const sorted = filtered
    .map(buildThreadSummary)
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    )

  const page = sorted.slice(params.offset, params.offset + params.limit)
  const unreadCount = filtered.reduce((acc, t) => acc + (t.unreadCount > 0 ? 1 : 0), 0)
  return {
    threads: page,
    totalCount: sorted.length,
    unreadCount,
    hasMore: params.offset + page.length < sorted.length,
  }
}

export async function fetchThread(params: {
  phoneDigits: string
  limit?: number
  beforeId?: string
}): Promise<{
  thread: SmsThread | null
  canSend: boolean
  hasOlder: boolean
}> {
  await delay(jitter(60))
  const found = state.threads.find(t => t.phoneDigits === params.phoneDigits)
  if (!found)
    return { thread: null, canSend: MOCK_SESSION.isAgentLinked, hasOlder: false }

  const limit = params.limit ?? 30
  const all = found.messages
  let endIdx = all.length
  if (params.beforeId) {
    const idx = all.findIndex(m => m.id === params.beforeId)
    if (idx >= 0) endIdx = idx
  }
  const startIdx = Math.max(0, endIdx - limit)
  const window = all.slice(startIdx, endIdx)

  return {
    thread: { ...found, messages: window },
    canSend: MOCK_SESSION.isAgentLinked,
    hasOlder: startIdx > 0,
  }
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  await delay(jitter(40))
  const count = state.threads.filter(
    t => t.assignedToCurrentUser && t.unreadCount > 0,
  ).length
  return { count }
}

export async function markThreadRead(phoneDigits: string): Promise<void> {
  await delay(jitter(40))
  const t = state.threads.find(x => x.phoneDigits === phoneDigits)
  if (t) {
    t.unreadCount = 0
    notify()
  }
}

export async function sendSms(params: {
  phoneDigits: string
  text: string
}): Promise<{ message: SmsMessage }> {
  // Longer delay so the optimistic-pending bubble is visible before confirm.
  await delay(jitter(250))

  if (params.phoneDigits === FAIL_PHONE_DIGITS) {
    throw new Error('cloudtalk_send_failed')
  }

  const t = state.threads.find(x => x.phoneDigits === params.phoneDigits)
  if (!t) throw new Error('Thread not found')

  const msg: SmsMessage = {
    id: `out-${Date.now()}`,
    direction: 'outbound',
    text: params.text,
    agent: MOCK_SESSION.displayName,
    createdAt: new Date().toISOString(),
    status: 'sent',
  }
  t.messages.push(msg)
  t.assignedToCurrentUser = true
  notify()
  return { message: msg }
}

export async function searchCustomers(term: string): Promise<MockCustomer[]> {
  await delay(jitter(60))
  const lower = term.trim().toLowerCase()
  if (!lower) return []
  return state.customers
    .filter(c => c.name.toLowerCase().includes(lower) || c.phone.includes(lower))
    .slice(0, 10)
}

export async function linkExistingCustomer(params: {
  phoneDigits: string
  customerId: number
}): Promise<{ customerId: number; customerName: string }> {
  await delay(jitter(80))
  const c = state.customers.find(x => x.id === params.customerId)
  if (!c) throw new Error('Customer not found')
  c.phone = params.phoneDigits
  const t = state.threads.find(x => x.phoneDigits === params.phoneDigits)
  if (t) {
    t.customer = { id: c.id, name: c.name }
    notify()
  }
  return { customerId: c.id, customerName: c.name }
}

export async function createCustomerForPhone(params: {
  phoneDigits: string
  name: string
}): Promise<{ customerId: number; customerName: string }> {
  await delay(jitter(80))
  const newId = Math.max(...state.customers.map(c => c.id), 0) + 1
  const newCustomer: MockCustomer = {
    id: newId,
    name: params.name.trim(),
    phone: params.phoneDigits,
  }
  state.customers.push(newCustomer)
  const t = state.threads.find(x => x.phoneDigits === params.phoneDigits)
  if (t) {
    t.customer = { id: newCustomer.id, name: newCustomer.name }
    notify()
  }
  return { customerId: newCustomer.id, customerName: newCustomer.name }
}

export function setMockAgentLinked(linked: boolean) {
  MOCK_SESSION.isAgentLinked = linked
  notify()
}

export function setMockIsAdmin(isAdmin: boolean) {
  MOCK_SESSION.isAdmin = isAdmin
  notify()
}

// Test-only: reset in-process state to the initial fixtures.
export function __resetMockState() {
  state.threads = structuredClone(MOCK_THREADS) as SmsThread[]
  state.customers = structuredClone(MOCK_CUSTOMERS) as MockCustomer[]
  MOCK_SESSION.isAdmin = true
  MOCK_SESSION.isAgentLinked = true
  subscribers.clear()
}
