import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'
import type { Nullable } from '~/types/utils'
import { DatabaseTestHelper, TestDataFactory } from '../../tests/testDatabase'
import {
  __resetPendingCleanupThrottle,
  canUserSendSms,
  fetchCustomerByPhone,
  finalizeOutboundSms,
  getThreadForUser,
  getThreadUnreadCountForUser,
  getUnreadThreadCountForUser,
  insertPendingOutboundSms,
  listThreadsForUser,
  markThreadReadForUser,
  userHasMessagesForPhone,
} from './cloudtalkSmsService.server'

const helper = new DatabaseTestHelper()
const factory = new TestDataFactory(helper)

beforeAll(async () => {
  await DatabaseTestHelper.ensureDatabase()
})

afterAll(async () => {
  await DatabaseTestHelper.disconnect()
})

beforeEach(async () => {
  await helper.setup()
  __resetPendingCleanupThrottle()
})

afterEach(async () => {
  await helper.teardown()
})

describe('getThreadUnreadCountForUser', () => {
  test('counts inbound newer than last_read_at, clears after mark-read', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'u1',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'u2',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'u3',
    })

    expect(await getThreadUnreadCountForUser(admin, '3173161456')).toBe(3)

    await markThreadReadForUser({ user: admin, phoneDigits: '3173161456' })

    expect(await getThreadUnreadCountForUser(admin, '3173161456')).toBe(0)
  })

  test('canonicalizes 11-digit input to match 10-digit stored sender', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'a',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'b',
    })

    // UI may pass the 11-digit (leading 1) form; it must resolve to the same thread.
    expect(await getThreadUnreadCountForUser(admin, '13173161456')).toBe(2)
  })

  test('counts inbound only, not outbound, on the same thread', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'in',
    })
    await factory.smsOutbound({
      company_id: company.id,
      recipient: '3173161456',
      sender_user_id: admin.id,
    })
    expect(await getThreadUnreadCountForUser(admin, '3173161456')).toBe(1)
  })
})

describe('listThreadsForUser', () => {
  test('admin sees every thread in their company', async () => {
    const company = await factory.company()
    const otherCompany = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })

    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'A1',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '5125559090',
      text: 'B1',
    })
    await factory.smsInbound({
      company_id: otherCompany.id,
      sender: '9999999999',
      text: 'X1',
    })

    const result = await listThreadsForUser({
      user: admin,
      search: '',
      limit: 20,
      offset: 0,
    })

    expect(result.totalCount).toBe(2)
    expect(result.threads.map(t => t.phoneDigits).sort()).toEqual([
      '3173161456',
      '5125559090',
    ])
  })

  test('employee sees only threads their agent participated in', async () => {
    const company = await factory.company()
    const user = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })

    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      agent: 'agent-A',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '5125559090',
      agent: 'agent-B',
    })

    const result = await listThreadsForUser({
      user,
      search: '',
      limit: 20,
      offset: 0,
    })

    expect(result.threads.map(t => t.phoneDigits)).toEqual(['3173161456'])
  })

  test('employee sees their own outbound threads even without inbound match', async () => {
    const company = await factory.company()
    const user = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })

    await factory.smsOutbound({
      company_id: company.id,
      recipient: '3173161456',
      sender_user_id: user.id,
      agent: 'agent-A',
    })

    const result = await listThreadsForUser({
      user,
      search: '',
      limit: 20,
      offset: 0,
    })

    expect(result.threads).toHaveLength(1)
    expect(result.threads[0].phoneDigits).toBe('3173161456')
    expect(result.threads[0].lastDirection).toBe('outbound')
  })
})

describe('getThreadForUser', () => {
  test('returns most-recent N messages first', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    for (let i = 0; i < 40; i++) {
      await factory.smsInbound({
        company_id: company.id,
        sender: '3173161456',
        text: `msg ${i}`,
        created_date: new Date(Date.now() - (40 - i) * 1000),
      })
    }
    const result = await getThreadForUser({
      user: admin,
      phoneDigits: '3173161456',
      limit: 30,
    })
    expect(result.messages).toHaveLength(30)
    expect(result.hasOlder).toBe(true)
    expect(result.messages[0].text).toBe('msg 10')
    expect(result.messages[29].text).toBe('msg 39')
  })

  test('beforeId cursor returns next older page', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    const ids: number[] = []
    for (let i = 0; i < 5; i++) {
      const row = await factory.smsInbound({
        company_id: company.id,
        sender: '3173161456',
        text: `msg ${i}`,
        created_date: new Date(Date.now() - (5 - i) * 1000),
      })
      ids.push(row.id)
    }
    const result = await getThreadForUser({
      user: admin,
      phoneDigits: '3173161456',
      limit: 2,
      beforeId: String(ids[2]),
    })
    expect(result.messages.map(m => m.text)).toEqual(['msg 0', 'msg 1'])
    expect(result.hasOlder).toBe(false)
  })

  test('returns empty when phone not visible to employee', async () => {
    const company = await factory.company()
    const user = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      agent: 'agent-B',
    })
    const result = await getThreadForUser({
      user,
      phoneDigits: '3173161456',
      limit: 30,
    })
    expect(result.messages).toEqual([])
  })

  test('excludes outbound pending/failed rows (handled optimistically client-side)', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'in',
    })
    await factory.smsOutbound({
      company_id: company.id,
      recipient: '3173161456',
      sender_user_id: admin.id,
      text: 'sent ok',
      status: 'sent',
    })
    await factory.smsOutbound({
      company_id: company.id,
      recipient: '3173161456',
      sender_user_id: admin.id,
      text: 'still sending',
      status: 'pending',
    })
    await factory.smsOutbound({
      company_id: company.id,
      recipient: '3173161456',
      sender_user_id: admin.id,
      text: 'failed one',
      status: 'failed',
    })

    const result = await getThreadForUser({
      user: admin,
      phoneDigits: '3173161456',
      limit: 30,
    })
    const texts = result.messages.map(m => m.text)
    expect(texts).toContain('in')
    expect(texts).toContain('sent ok')
    expect(texts).not.toContain('still sending')
    expect(texts).not.toContain('failed one')
  })
})

describe('markThreadReadForUser', () => {
  test('inserts on first call, updates on second', async () => {
    const company = await factory.company()
    const user = await factory.user({ company_id: company.id, is_admin: true })

    await markThreadReadForUser({ user, phoneDigits: '3173161456' })
    const firstRows = await helper.query<{ last_read_at: Date | string }>(
      'SELECT last_read_at FROM cloudtalk_sms_thread_reads WHERE user_id = ? AND customer_phone_digits = ?',
      [user.id, '3173161456'],
    )
    expect(firstRows).toHaveLength(1)

    await new Promise(r => setTimeout(r, 1100))
    await markThreadReadForUser({ user, phoneDigits: '3173161456' })

    const secondRows = await helper.query<{ last_read_at: Date | string }>(
      'SELECT last_read_at FROM cloudtalk_sms_thread_reads WHERE user_id = ? AND customer_phone_digits = ?',
      [user.id, '3173161456'],
    )
    expect(secondRows).toHaveLength(1)
    expect(new Date(secondRows[0].last_read_at).getTime()).toBeGreaterThan(
      new Date(firstRows[0].last_read_at).getTime(),
    )
  })
})

describe('getUnreadThreadCountForUser', () => {
  test('counts distinct phones with unread inbound newer than last_read_at', async () => {
    const company = await factory.company()
    const user = await factory.user({ company_id: company.id, is_admin: true })

    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      text: 'unread A',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '5125559090',
      text: 'unread B',
    })

    const before = await getUnreadThreadCountForUser(user)
    expect(before).toBe(2)

    await markThreadReadForUser({ user, phoneDigits: '3173161456' })

    const after = await getUnreadThreadCountForUser(user)
    expect(after).toBe(1)
  })

  test('does not count outbound rows as unread', async () => {
    const company = await factory.company()
    const user = await factory.user({ company_id: company.id, is_admin: true })
    await factory.smsOutbound({
      company_id: company.id,
      recipient: '3173161456',
      sender_user_id: user.id,
    })
    const result = await getUnreadThreadCountForUser(user)
    expect(result).toBe(0)
  })
})

describe('fetchCustomerByPhone', () => {
  test('returns customer linked to phone via cloudtalk_contacts (last-10 match)', async () => {
    const company = await factory.company()
    const customer = await factory.customer({
      company_id: company.id,
      name: 'Linked Customer',
    })
    await factory.cloudtalkContact({
      customer_id: customer.id,
      company_id: company.id,
      cloudtalk_id: 1001,
      phone_e164_1: '+13173161456',
    })

    const result = await fetchCustomerByPhone(company.id, '3173161456')
    expect(result).not.toBeNull()
    expect(result?.id).toBe(customer.id)
    expect(result?.name).toBe('Linked Customer')
  })

  test('matches on phone_e164_2 as fallback', async () => {
    const company = await factory.company()
    const customer = await factory.customer({
      company_id: company.id,
      name: 'Second Phone Customer',
    })
    await factory.cloudtalkContact({
      customer_id: customer.id,
      company_id: company.id,
      cloudtalk_id: 1002,
      phone_e164_1: '+15555550001',
      phone_e164_2: '+13173161456',
    })

    const result = await fetchCustomerByPhone(company.id, '3173161456')
    expect(result?.id).toBe(customer.id)
  })

  test('returns null when no contact links the phone', async () => {
    const company = await factory.company()
    const result = await fetchCustomerByPhone(company.id, '9999999999')
    expect(result).toBeNull()
  })

  test('falls back to customers.phone when not yet in cloudtalk_contacts', async () => {
    const company = await factory.company()
    const customer = await factory.customer({
      company_id: company.id,
      name: 'Unsynced Customer',
      phone: '(317) 316-1456',
    })

    const result = await fetchCustomerByPhone(company.id, '3173161456')
    expect(result?.id).toBe(customer.id)
    expect(result?.name).toBe('Unsynced Customer')
  })

  test('falls back to customers.phone_2 when not yet in cloudtalk_contacts', async () => {
    const company = await factory.company()
    const customer = await factory.customer({
      company_id: company.id,
      name: 'Second Phone Unsynced',
      phone: '555-555-0001',
      phone_2: '317-316-1456',
    })

    const result = await fetchCustomerByPhone(company.id, '3173161456')
    expect(result?.id).toBe(customer.id)
  })

  test('direct fallback does not cross company boundaries', async () => {
    const company = await factory.company()
    const otherCompany = await factory.company()
    await factory.customer({
      company_id: otherCompany.id,
      name: 'Other Co Unsynced',
      phone: '3173161456',
    })

    const result = await fetchCustomerByPhone(company.id, '3173161456')
    expect(result).toBeNull()
  })
})

describe('canUserSendSms', () => {
  test('any user with a linked agent id may send', async () => {
    const company = await factory.company()
    const employee = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })
    expect(canUserSendSms(employee)).toBe(true)
  })

  test('a user without an agent id is read-only', async () => {
    const company = await factory.company()
    const employee = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: null,
    })
    expect(canUserSendSms(employee)).toBe(false)
  })

  test('admins and superusers may send when they have an agent id', async () => {
    const company = await factory.company()
    const admin = await factory.user({
      company_id: company.id,
      is_admin: true,
      cloudtalk_agent_id: 'agent-A',
    })
    const superuser = await factory.user({
      company_id: company.id,
      is_superuser: true,
      cloudtalk_agent_id: 'agent-B',
    })
    expect(canUserSendSms(admin)).toBe(true)
    expect(canUserSendSms(superuser)).toBe(true)
  })

  test('does not cross company boundaries', async () => {
    const company = await factory.company()
    const otherCompany = await factory.company()
    const otherCustomer = await factory.customer({
      company_id: otherCompany.id,
      name: 'Other Co Customer',
    })
    await factory.cloudtalkContact({
      customer_id: otherCustomer.id,
      company_id: otherCompany.id,
      cloudtalk_id: 1003,
      phone_e164_1: '+13173161456',
    })

    const result = await fetchCustomerByPhone(company.id, '3173161456')
    expect(result).toBeNull()
  })
})

describe('insertPendingOutboundSms + finalizeOutboundSms', () => {
  test('pending then sent persists final state', async () => {
    const company = await factory.company()
    const user = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })
    const pending = await insertPendingOutboundSms({
      user,
      phoneDigits: '3173161456',
      text: 'hello',
    })
    expect(pending.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    const row = await finalizeOutboundSms({
      id: pending.id,
      status: 'sent',
      cloudtalkId: 42,
      errorMessage: null,
    })
    expect(row.direction).toBe('outbound')
    expect(row.status).toBe('sent')
    expect(row.cloudtalkId).toBe(42)
    expect(row.text).toBe('hello')
    expect(row.senderUserId).toBe(user.id)
    expect(row.agent).toBe('agent-A')

    const stored = await helper.query<{ idempotency_key: string }>(
      'SELECT idempotency_key FROM cloudtalk_sms WHERE id = ?',
      [pending.id],
    )
    expect(stored[0].idempotency_key).toBe(pending.idempotencyKey)
  })

  test('pending then failed persists with error_message', async () => {
    const company = await factory.company()
    const user = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })
    const pending = await insertPendingOutboundSms({
      user,
      phoneDigits: '3173161456',
      text: 'oops',
    })
    expect(pending.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    const row = await finalizeOutboundSms({
      id: pending.id,
      status: 'failed',
      cloudtalkId: null,
      errorMessage: 'cloudtalk_429',
    })
    expect(row.status).toBe('failed')
    expect(row.errorMessage).toBe('cloudtalk_429')
    expect(row.cloudtalkId).toBeNull()
  })

  test('each pending insert generates a unique idempotency key', async () => {
    const company = await factory.company()
    const user = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })
    const a = await insertPendingOutboundSms({
      user,
      phoneDigits: '3173161456',
      text: 'one',
    })
    const b = await insertPendingOutboundSms({
      user,
      phoneDigits: '3173161456',
      text: 'two',
    })
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
  })
})

describe('userHasMessagesForPhone', () => {
  test('returns true when employee has a visible message for the phone', async () => {
    const company = await factory.company()
    const user = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      agent: 'agent-A',
    })
    const result = await userHasMessagesForPhone(user, '3173161456')
    expect(result).toBe(true)
  })

  test('returns false when no row exists for that phone', async () => {
    const company = await factory.company()
    const user = await factory.user({ company_id: company.id, is_admin: true })
    const result = await userHasMessagesForPhone(user, '3173161456')
    expect(result).toBe(false)
  })

  test('returns false when the row exists but is not visible to the employee', async () => {
    const company = await factory.company()
    const user = await factory.user({
      company_id: company.id,
      is_employee: true,
      cloudtalk_agent_id: 'agent-A',
    })
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      agent: 'agent-B',
    })
    const result = await userHasMessagesForPhone(user, '3173161456')
    expect(result).toBe(false)
  })
})

describe('cloudtalk_sms unique constraint on (company_id, cloudtalk_id)', () => {
  test('duplicate (company_id, cloudtalk_id) is rejected', async () => {
    const company = await factory.company()
    await factory.smsInbound({
      company_id: company.id,
      sender: '3173161456',
      cloudtalk_id: 42,
    })
    await expect(
      factory.smsInbound({
        company_id: company.id,
        sender: '5125559090',
        cloudtalk_id: 42,
      }),
    ).rejects.toThrow()
  })

  test('null cloudtalk_id permits multiple rows', async () => {
    const company = await factory.company()
    await factory.smsInbound({ company_id: company.id, sender: '3173161456' })
    await factory.smsInbound({ company_id: company.id, sender: '5125559090' })
    const rows = await helper.query('SELECT COUNT(*) AS c FROM cloudtalk_sms')
    expect(Number((rows[0] as { c: number }).c)).toBe(2)
  })
})

describe('expireStalePendingOutbound (via listThreadsForUser)', () => {
  test('pending rows older than threshold become failed', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    await helper.query(
      `INSERT INTO cloudtalk_sms
         (cloudtalk_id, sender, recipient, text, direction, status, error_message,
          agent, sender_user_id, company_id, created_date)
       VALUES (NULL, NULL, ?, ?, 'outbound', 'pending', NULL, ?, ?, ?,
               DATE_SUB(NOW(), INTERVAL 10 MINUTE))`,
      ['3173161456', 'stale', 'agent-A', admin.id, company.id],
    )
    await listThreadsForUser({ user: admin, search: '', limit: 20, offset: 0 })
    const rows = await helper.query<{
      status: string
      error_message: Nullable<string>
    }>('SELECT status, error_message FROM cloudtalk_sms WHERE company_id = ?', [
      company.id,
    ])
    expect(rows[0].status).toBe('failed')
    expect(rows[0].error_message).toBe('pending_timeout')
  })

  test('fresh pending rows are not expired', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    await helper.query(
      `INSERT INTO cloudtalk_sms
         (cloudtalk_id, sender, recipient, text, direction, status, error_message,
          agent, sender_user_id, company_id, created_date)
       VALUES (NULL, NULL, ?, ?, 'outbound', 'pending', NULL, ?, ?, ?, NOW())`,
      ['3173161456', 'fresh', 'agent-A', admin.id, company.id],
    )
    await listThreadsForUser({ user: admin, search: '', limit: 20, offset: 0 })
    const rows = await helper.query<{ status: string }>(
      'SELECT status FROM cloudtalk_sms WHERE company_id = ?',
      [company.id],
    )
    expect(rows[0].status).toBe('pending')
  })

  test('does not touch sent or failed rows even if old', async () => {
    const company = await factory.company()
    const admin = await factory.user({ company_id: company.id, is_admin: true })
    await helper.query(
      `INSERT INTO cloudtalk_sms
         (cloudtalk_id, sender, recipient, text, direction, status, error_message,
          agent, sender_user_id, company_id, created_date)
       VALUES
         (NULL, NULL, ?, 'old sent', 'outbound', 'sent', NULL, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 10 MINUTE)),
         (NULL, NULL, ?, 'old failed', 'outbound', 'failed', 'x', ?, ?, ?, DATE_SUB(NOW(), INTERVAL 10 MINUTE)),
         (NULL, ?,    ?, 'old inbound', 'inbound', 'received', NULL, NULL, NULL, ?, DATE_SUB(NOW(), INTERVAL 10 MINUTE))`,
      [
        '3173161456',
        'agent-A',
        admin.id,
        company.id,
        '3173161457',
        'agent-A',
        admin.id,
        company.id,
        '3173161458',
        '3173161458',
        company.id,
      ],
    )
    await listThreadsForUser({ user: admin, search: '', limit: 20, offset: 0 })
    const rows = await helper.query<{ text: string; status: string }>(
      'SELECT text, status FROM cloudtalk_sms WHERE company_id = ? ORDER BY id',
      [company.id],
    )
    expect(rows[0].status).toBe('sent')
    expect(rows[1].status).toBe('failed')
    expect(rows[2].status).toBe('received')
  })
})
