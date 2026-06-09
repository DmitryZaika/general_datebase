import type { Nullable } from '~/types/utils'
import type {
  CustomerSearchResult,
  SmsMessage,
  SmsThread,
  ThreadSummary,
} from './types'

export interface FetchThreadsParams {
  scope: 'mine' | 'all'
  search: string
  limit: number
  offset: number
  agentId?: string
}

export interface FetchThreadsResult {
  threads: ThreadSummary[]
  totalCount: number
  unreadCount: number
  hasMore: boolean
}

export async function fetchThreads(
  params: FetchThreadsParams,
): Promise<FetchThreadsResult> {
  const qs = new URLSearchParams({
    search: params.search,
    limit: String(params.limit),
    offset: String(params.offset),
    scope: params.scope,
  })
  if (params.agentId) qs.set('agentId', params.agentId)
  const res = await fetch(`/api/cloudtalk/sms/threads?${qs}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`fetch_threads_failed:${res.status}`)
  return (await res.json()) as FetchThreadsResult
}

export interface FetchThreadResult {
  thread: Nullable<SmsThread>
  canSend: boolean
  hasOlder: boolean
}

export async function fetchThread(params: {
  phoneDigits: string
  limit?: number
  beforeId?: string
  scope?: FetchThreadsParams['scope']
  agentId?: string
}): Promise<FetchThreadResult> {
  const qs = new URLSearchParams()
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.beforeId !== undefined) qs.set('beforeId', params.beforeId)
  if (params.scope !== undefined) qs.set('scope', params.scope)
  if (params.agentId) qs.set('agentId', params.agentId)
  const url = qs.toString()
    ? `/api/cloudtalk/sms/thread/${params.phoneDigits}?${qs}`
    : `/api/cloudtalk/sms/thread/${params.phoneDigits}`
  const res = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`fetch_thread_failed:${res.status}`)
  return (await res.json()) as FetchThreadResult
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  const res = await fetch('/api/cloudtalk/sms/unread-count', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`fetch_unread_count_failed:${res.status}`)
  return (await res.json()) as { count: number }
}

export async function fetchUnreadEmailCount(): Promise<{ count: number }> {
  const res = await fetch('/api/emails/unread-count', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`fetch_unread_email_count_failed:${res.status}`)
  return (await res.json()) as { count: number }
}

export async function markThreadRead(
  phoneDigits: string,
  csrfToken: string,
): Promise<void> {
  const form = new FormData()
  form.set('csrf', csrfToken)
  form.set('phoneDigits', phoneDigits)
  const res = await fetch('/api/cloudtalk/sms/mark-read', {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`mark_read_failed:${res.status}`)
}

export async function sendSms(params: {
  phoneDigits: string
  text: string
  csrfToken: string
}): Promise<{ message: SmsMessage }> {
  const form = new FormData()
  form.set('csrf', params.csrfToken)
  form.set('phoneDigits', params.phoneDigits)
  form.set('text', params.text)
  const res = await fetch('/api/cloudtalk/sms/send', {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'send_failed' }))) as {
      error?: string
    }
    throw new Error(body.error ?? 'send_failed')
  }
  return (await res.json()) as { message: SmsMessage }
}

export async function searchCustomers(term: string): Promise<CustomerSearchResult[]> {
  const qs = new URLSearchParams({ term })
  const res = await fetch(`/api/customers/sms-search?${qs}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`search_customers_failed:${res.status}`)
  const body = (await res.json()) as { customers: CustomerSearchResult[] }
  return body.customers
}

export async function linkExistingCustomer(params: {
  phoneDigits: string
  customerId: number
  csrfToken: string
}): Promise<{ customerId: number; customerName: string }> {
  const form = new FormData()
  form.set('csrf', params.csrfToken)
  form.set('phoneDigits', params.phoneDigits)
  form.set('customerId', String(params.customerId))
  const res = await fetch('/api/customers/link-phone', {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`link_customer_failed:${res.status}`)
  return (await res.json()) as { customerId: number; customerName: string }
}

export async function createCustomerForPhone(params: {
  phoneDigits: string
  name: string
  csrfToken: string
}): Promise<{ customerId: number; customerName: string }> {
  const form = new FormData()
  form.set('csrf', params.csrfToken)
  form.set('phoneDigits', params.phoneDigits)
  form.set('name', params.name)
  const res = await fetch('/api/customers/create-from-phone', {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`create_customer_failed:${res.status}`)
  return (await res.json()) as { customerId: number; customerName: string }
}
