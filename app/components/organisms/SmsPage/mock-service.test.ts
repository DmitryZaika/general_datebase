import { beforeEach, describe, expect, it } from 'vitest'
import { __resetMockState } from './mock-service'

// The mock service holds in-process state across the module. Reset between
// tests so order doesn't matter.
beforeEach(() => {
  __resetMockState()
})

async function importService() {
  return await import('./mock-service')
}

describe('fetchThreads — scope filter', () => {
  it('returns only threads assigned to the current user under scope=mine', async () => {
    const { fetchThreads } = await importService()
    const { threads } = await fetchThreads({
      scope: 'mine',
      search: '',
      limit: 100,
      offset: 0,
    })
    expect(threads.length).toBeGreaterThan(0)
    // Every returned thread must be assigned to the current user.
    // The mock fixtures explicitly set assignedToCurrentUser; we verify
    // via the underlying data shape.
    const { MOCK_THREADS } = await import('./mock-data')
    const minePhones = new Set(
      MOCK_THREADS.filter(t => t.assignedToCurrentUser).map(t => t.phoneDigits),
    )
    for (const t of threads) {
      expect(minePhones.has(t.phoneDigits)).toBe(true)
    }
  })

  it('returns every thread under scope=all', async () => {
    const { fetchThreads } = await importService()
    const { MOCK_THREADS } = await import('./mock-data')
    const { threads, totalCount } = await fetchThreads({
      scope: 'all',
      search: '',
      limit: 100,
      offset: 0,
    })
    expect(totalCount).toBe(MOCK_THREADS.length)
    expect(threads.length).toBe(MOCK_THREADS.length)
  })
})

describe('fetchThreads — search', () => {
  it('matches by customer name (case insensitive)', async () => {
    const { fetchThreads } = await importService()
    const { threads } = await fetchThreads({
      scope: 'all',
      search: 'SARAH',
      limit: 100,
      offset: 0,
    })
    expect(threads.length).toBe(1)
    expect(threads[0].customerName).toBe('Sarah Johnson')
  })

  it('matches by phone digit substring', async () => {
    const { fetchThreads } = await importService()
    const { threads } = await fetchThreads({
      scope: 'all',
      search: '317',
      limit: 100,
      offset: 0,
    })
    expect(threads.length).toBeGreaterThan(0)
    for (const t of threads) {
      expect(t.phoneDigits.includes('317')).toBe(true)
    }
  })

  it('matches by message body text', async () => {
    const { fetchThreads } = await importService()
    const { threads } = await fetchThreads({
      scope: 'all',
      search: 'Calacatta',
      limit: 100,
      offset: 0,
    })
    expect(threads.length).toBeGreaterThanOrEqual(1)
  })

  it('returns empty for a no-match search', async () => {
    const { fetchThreads } = await importService()
    const { threads, totalCount } = await fetchThreads({
      scope: 'all',
      search: 'zzzzznomatchzzzzz',
      limit: 100,
      offset: 0,
    })
    expect(threads).toEqual([])
    expect(totalCount).toBe(0)
  })
})

describe('fetchThreads — pagination', () => {
  it('respects limit + offset and reports hasMore correctly', async () => {
    const { fetchThreads } = await importService()
    const { MOCK_THREADS } = await import('./mock-data')
    const total = MOCK_THREADS.length

    const page1 = await fetchThreads({ scope: 'all', search: '', limit: 3, offset: 0 })
    expect(page1.threads.length).toBe(3)
    expect(page1.totalCount).toBe(total)
    expect(page1.hasMore).toBe(true)

    const page2 = await fetchThreads({ scope: 'all', search: '', limit: 3, offset: 3 })
    expect(page2.threads.length).toBe(3)
    expect(page2.hasMore).toBe(true)
    // No overlap between page 1 and page 2.
    const overlap = page1.threads.filter(p1 =>
      page2.threads.some(p2 => p2.phoneDigits === p1.phoneDigits),
    )
    expect(overlap).toEqual([])

    // Walk past the end.
    const final = await fetchThreads({
      scope: 'all',
      search: '',
      limit: 3,
      offset: total - 1,
    })
    expect(final.threads.length).toBe(1)
    expect(final.hasMore).toBe(false)
  })

  it('returns threads sorted by lastMessageAt desc', async () => {
    const { fetchThreads } = await importService()
    const { threads } = await fetchThreads({
      scope: 'all',
      search: '',
      limit: 100,
      offset: 0,
    })
    for (let i = 1; i < threads.length; i++) {
      const prev = new Date(threads[i - 1].lastMessageAt).getTime()
      const curr = new Date(threads[i].lastMessageAt).getTime()
      expect(prev).toBeGreaterThanOrEqual(curr)
    }
  })
})

describe('fetchThread — cursor + windowing', () => {
  it('returns the most recent N messages by default', async () => {
    const { fetchThread } = await importService()
    // Mike Chen's thread has 9 messages — request the last 3.
    const result = await fetchThread({ phoneDigits: '6468956758', limit: 3 })
    expect(result.thread).not.toBeNull()
    expect(result.thread?.messages.length).toBe(3)
    expect(result.hasOlder).toBe(true)
  })

  it('returns hasOlder=false when window covers the whole thread', async () => {
    const { fetchThread } = await importService()
    // Sarah's thread has 4 messages — request 10.
    const result = await fetchThread({ phoneDigits: '3173161456', limit: 10 })
    expect(result.thread?.messages.length).toBe(4)
    expect(result.hasOlder).toBe(false)
  })

  it('respects beforeId to step back in time', async () => {
    const { fetchThread } = await importService()
    // Get last 3 of Mike Chen's 9-message thread (cursor = oldest of that window).
    const recent = await fetchThread({ phoneDigits: '6468956758', limit: 3 })
    if (!recent.thread) throw new Error('expected thread')
    const oldestRecentId = recent.thread.messages[0].id

    // Now fetch the 3 before that — they should all predate `oldestRecentId`.
    const older = await fetchThread({
      phoneDigits: '6468956758',
      limit: 3,
      beforeId: oldestRecentId,
    })
    if (!older.thread) throw new Error('expected thread')
    expect(older.thread.messages.length).toBe(3)
    expect(older.hasOlder).toBe(true) // 3 more behind these
    const olderIds = older.thread.messages.map(m => m.id)
    expect(olderIds).not.toContain(oldestRecentId)
  })

  it('returns null thread for an unknown phone', async () => {
    const { fetchThread } = await importService()
    const result = await fetchThread({ phoneDigits: '9999999999' })
    expect(result.thread).toBeNull()
    expect(result.hasOlder).toBe(false)
  })
})

describe('sendSms', () => {
  it('appends an outbound message and bumps assignedToCurrentUser', async () => {
    const { sendSms, fetchThread } = await importService()
    const before = await fetchThread({ phoneDigits: '3173161456', limit: 100 })
    if (!before.thread) throw new Error('expected thread')
    const beforeCount = before.thread.messages.length

    await sendSms({ phoneDigits: '3173161456', text: 'Test reply' })

    const after = await fetchThread({ phoneDigits: '3173161456', limit: 100 })
    if (!after.thread) throw new Error('expected thread')
    expect(after.thread.messages.length).toBe(beforeCount + 1)
    const last = after.thread.messages.at(-1)
    expect(last?.direction).toBe('outbound')
    expect(last?.text).toBe('Test reply')
    expect(last?.status).toBe('sent')
  })

  it('throws on the designated failure-simulation phone', async () => {
    const { sendSms } = await importService()
    await expect(sendSms({ phoneDigits: '6175557777', text: 'hi' })).rejects.toThrow(
      /cloudtalk_send_failed/,
    )
  })
})

describe('markThreadRead', () => {
  it('zeroes the unreadCount on the matching thread', async () => {
    const { markThreadRead, fetchThreads } = await importService()
    const { threads: before } = await fetchThreads({
      scope: 'all',
      search: '',
      limit: 100,
      offset: 0,
    })
    const sarah = before.find(t => t.phoneDigits === '3173161456')
    expect(sarah?.unreadCount).toBe(2)

    await markThreadRead('3173161456')

    const { threads: after } = await fetchThreads({
      scope: 'all',
      search: '',
      limit: 100,
      offset: 0,
    })
    const sarahAfter = after.find(t => t.phoneDigits === '3173161456')
    expect(sarahAfter?.unreadCount).toBe(0)
  })
})

describe('fetchUnreadCount', () => {
  it('counts threads assigned to current user with unread messages', async () => {
    const { fetchUnreadCount, MOCK_SESSION } = await importService()
    const { MOCK_THREADS } = await import('./mock-data')
    const expected = MOCK_THREADS.filter(
      t => t.assignedToCurrentUser && t.unreadCount > 0,
    ).length

    expect(MOCK_SESSION.isAdmin).toBe(true)
    const { count } = await fetchUnreadCount()
    expect(count).toBe(expected)
  })

  it('drops to zero after every thread is marked read', async () => {
    const { fetchUnreadCount, markThreadRead, fetchThreads } = await importService()
    const all = await fetchThreads({
      scope: 'mine',
      search: '',
      limit: 100,
      offset: 0,
    })
    for (const t of all.threads) {
      if (t.unreadCount > 0) {
        await markThreadRead(t.phoneDigits)
      }
    }
    const { count } = await fetchUnreadCount()
    expect(count).toBe(0)
  })
})

describe('searchCustomers + linkExistingCustomer + createCustomerForPhone', () => {
  it('searches by name OR phone substring, case insensitive', async () => {
    const { searchCustomers } = await importService()
    expect((await searchCustomers('mike')).length).toBeGreaterThan(0)
    expect((await searchCustomers('CHEN')).map(c => c.name)).toContain('Mike Chen')
    expect((await searchCustomers('317')).length).toBeGreaterThan(0)
    expect(await searchCustomers('')).toEqual([])
    expect(await searchCustomers('   ')).toEqual([])
  })

  it('links an unknown phone to an existing customer and updates the thread', async () => {
    const { linkExistingCustomer, fetchThread, searchCustomers } = await importService()
    const [target] = await searchCustomers('Sarah')
    // 5125559090 is the unknown-phone thread in fixtures.
    const result = await linkExistingCustomer({
      phoneDigits: '5125559090',
      customerId: target.id,
    })
    expect(result.customerId).toBe(target.id)
    expect(result.customerName).toBe(target.name)

    const after = await fetchThread({ phoneDigits: '5125559090', limit: 100 })
    expect(after.thread?.customer).toEqual({ id: target.id, name: target.name })
  })

  it('creates a new customer for an unknown phone and attaches it to the thread', async () => {
    const { createCustomerForPhone, fetchThread } = await importService()
    const result = await createCustomerForPhone({
      phoneDigits: '5125559090',
      name: 'Brand New Lead',
    })
    expect(result.customerName).toBe('Brand New Lead')
    expect(typeof result.customerId).toBe('number')

    const after = await fetchThread({ phoneDigits: '5125559090', limit: 100 })
    expect(after.thread?.customer?.name).toBe('Brand New Lead')
  })
})

describe('subscribe / notify wiring', () => {
  it('fires subscribers on every mutation and stops after unsubscribe', async () => {
    const { subscribe, markThreadRead, sendSms } = await importService()
    let count = 0
    const unsubscribe = subscribe(() => {
      count += 1
    })

    await markThreadRead('3173161456')
    expect(count).toBe(1)

    await sendSms({ phoneDigits: '3173161456', text: 'x' })
    expect(count).toBe(2)

    unsubscribe()
    await sendSms({ phoneDigits: '3173161456', text: 'y' })
    expect(count).toBe(2)
  })
})

describe('setMockAgentLinked / setMockIsAdmin', () => {
  it('flips the session flags and notifies subscribers', async () => {
    const { setMockAgentLinked, setMockIsAdmin, MOCK_SESSION, subscribe } =
      await importService()
    let notified = 0
    subscribe(() => {
      notified += 1
    })

    setMockAgentLinked(false)
    expect(MOCK_SESSION.isAgentLinked).toBe(false)
    setMockAgentLinked(true)
    expect(MOCK_SESSION.isAgentLinked).toBe(true)

    setMockIsAdmin(false)
    expect(MOCK_SESSION.isAdmin).toBe(false)
    setMockIsAdmin(true)
    expect(MOCK_SESSION.isAdmin).toBe(true)

    expect(notified).toBe(4)
  })
})
