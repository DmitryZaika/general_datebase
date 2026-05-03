import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dbExecute = vi.fn()
const dbQuery = vi.fn()
const createCloudTalkContact = vi.fn()
const updateCloudTalkContact = vi.fn()
const deleteCloudTalkContact = vi.fn()
const findCloudTalkContactByPhone = vi.fn()
const captureException = vi.fn()

class CloudTalkApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'CloudTalkApiError'
  }
}

vi.mock('~/db.server', () => ({
  db: {
    execute: (...args: unknown[]) => dbExecute(...args),
    query: (...args: unknown[]) => dbQuery(...args),
  },
}))

vi.mock('~/utils/cloudtalk.server', () => ({
  CloudTalkApiError,
  createCloudTalkContact: (...args: unknown[]) => createCloudTalkContact(...args),
  updateCloudTalkContact: (...args: unknown[]) => updateCloudTalkContact(...args),
  deleteCloudTalkContact: (...args: unknown[]) => deleteCloudTalkContact(...args),
  findCloudTalkContactByPhone: (...args: unknown[]) =>
    findCloudTalkContactByPhone(...args),
}))

vi.mock('~/utils/posthog.server', () => ({
  posthogClient: {
    captureException: (...args: unknown[]) => captureException(...args),
  },
}))

interface QueryStub {
  match: (sql: string) => boolean
  rows: unknown[]
}

function setupQueries(stubs: QueryStub[]) {
  dbQuery.mockImplementation(async (sql: string) => {
    for (const stub of stubs) {
      if (stub.match(sql)) return [stub.rows]
    }
    return [[]]
  })
}

const customerRow = {
  id: 100,
  company_id: 7,
  name: 'Acme Co',
  phone: '317-316-1456',
  phone_2: null,
  email: 'a@b.com',
  address: '1 Main St',
  deleted_at: null,
}

const credsRow = {
  cloudtalk_access_key: 'key',
  cloudtalk_access_secret: 'secret',
}

beforeEach(() => {
  dbExecute.mockReset()
  dbQuery.mockReset()
  createCloudTalkContact.mockReset()
  updateCloudTalkContact.mockReset()
  deleteCloudTalkContact.mockReset()
  findCloudTalkContactByPhone.mockReset()
  findCloudTalkContactByPhone.mockResolvedValue(null)
  captureException.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('syncCustomerToCloudTalk', () => {
  it('creates a new contact and inserts a mapping when none exists', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [customerRow],
      },
      { match: sql => sql.includes('FROM cloudtalk_contacts'), rows: [] },
      { match: sql => sql.includes('FROM company'), rows: [credsRow] },
    ])
    createCloudTalkContact.mockResolvedValue(9999)
    dbExecute.mockResolvedValue([{ insertId: 1 }])

    const { syncCustomerToCloudTalk } = await import('./cloudtalkContactSync.server')
    await syncCustomerToCloudTalk(100)

    expect(findCloudTalkContactByPhone).toHaveBeenCalledWith(7, ['+13173161456'])
    expect(createCloudTalkContact).toHaveBeenCalledTimes(1)
    const [companyId, payload] = createCloudTalkContact.mock.calls[0]
    expect(companyId).toBe(7)
    expect(payload.name).toBe('Acme Co')
    expect(payload.ContactNumber).toEqual([{ public_number: '+13173161456' }])
    expect(payload.ContactEmail).toEqual([{ email: 'a@b.com' }])

    const insertCall = dbExecute.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO cloudtalk_contacts'),
    )
    expect(insertCall).toBeDefined()
    expect(insertCall?.[1]).toEqual([100, 7, 9999])
  })

  it('links to an existing CloudTalk contact when one is found by phone (no create)', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [customerRow],
      },
      { match: sql => sql.includes('FROM cloudtalk_contacts'), rows: [] },
      { match: sql => sql.includes('FROM company'), rows: [credsRow] },
    ])
    findCloudTalkContactByPhone.mockResolvedValue(7777)
    dbExecute.mockResolvedValue([{ insertId: 1 }])

    const { syncCustomerToCloudTalk } = await import('./cloudtalkContactSync.server')
    await syncCustomerToCloudTalk(100)

    expect(findCloudTalkContactByPhone).toHaveBeenCalledWith(7, ['+13173161456'])
    expect(createCloudTalkContact).not.toHaveBeenCalled()
    expect(updateCloudTalkContact).toHaveBeenCalledTimes(1)
    expect(updateCloudTalkContact.mock.calls[0][1]).toBe(7777)

    const insertCall = dbExecute.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO cloudtalk_contacts'),
    )
    expect(insertCall?.[1]).toEqual([100, 7, 7777])
  })

  it('updates an existing contact when mapping is present', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [customerRow],
      },
      {
        match: sql => sql.includes('FROM cloudtalk_contacts'),
        rows: [{ id: 5, cloudtalk_id: 12345 }],
      },
      { match: sql => sql.includes('FROM company'), rows: [credsRow] },
    ])
    dbExecute.mockResolvedValue([{}])

    const { syncCustomerToCloudTalk } = await import('./cloudtalkContactSync.server')
    await syncCustomerToCloudTalk(100)

    expect(updateCloudTalkContact).toHaveBeenCalledTimes(1)
    expect(updateCloudTalkContact.mock.calls[0][0]).toBe(7)
    expect(updateCloudTalkContact.mock.calls[0][1]).toBe(12345)
    expect(createCloudTalkContact).not.toHaveBeenCalled()
  })

  it('skips silently when company has no CloudTalk credentials', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [customerRow],
      },
      { match: sql => sql.includes('FROM cloudtalk_contacts'), rows: [] },
      {
        match: sql => sql.includes('FROM company'),
        rows: [{ cloudtalk_access_key: null, cloudtalk_access_secret: null }],
      },
    ])

    const { syncCustomerToCloudTalk } = await import('./cloudtalkContactSync.server')
    await syncCustomerToCloudTalk(100)

    expect(createCloudTalkContact).not.toHaveBeenCalled()
    expect(updateCloudTalkContact).not.toHaveBeenCalled()
  })

  it('skips when customer has no usable phone', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [{ ...customerRow, phone: null, phone_2: 'invalid' }],
      },
      { match: sql => sql.includes('FROM cloudtalk_contacts'), rows: [] },
      { match: sql => sql.includes('FROM company'), rows: [credsRow] },
    ])

    const { syncCustomerToCloudTalk } = await import('./cloudtalkContactSync.server')
    await syncCustomerToCloudTalk(100)

    expect(createCloudTalkContact).not.toHaveBeenCalled()
  })

  it('searches by both phone numbers when the customer has phone_2', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [{ ...customerRow, phone_2: '(415) 555-0100' }],
      },
      { match: sql => sql.includes('FROM cloudtalk_contacts'), rows: [] },
      { match: sql => sql.includes('FROM company'), rows: [credsRow] },
    ])
    createCloudTalkContact.mockResolvedValue(9999)
    dbExecute.mockResolvedValue([{ insertId: 1 }])

    const { syncCustomerToCloudTalk } = await import('./cloudtalkContactSync.server')
    await syncCustomerToCloudTalk(100)

    expect(findCloudTalkContactByPhone).toHaveBeenCalledWith(7, [
      '+13173161456',
      '+14155550100',
    ])
  })

  it('records last_error and does not throw when CloudTalk API fails', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [customerRow],
      },
      { match: sql => sql.includes('FROM cloudtalk_contacts'), rows: [] },
      { match: sql => sql.includes('FROM company'), rows: [credsRow] },
    ])
    createCloudTalkContact.mockRejectedValue(new Error('boom'))
    dbExecute.mockResolvedValue([{}])
    vi.spyOn(console, 'error').mockImplementation(() => {
      // suppress expected error log
    })

    const { syncCustomerToCloudTalk } = await import('./cloudtalkContactSync.server')
    await expect(syncCustomerToCloudTalk(100)).resolves.toBeUndefined()

    const errorWriteCall = dbExecute.mock.calls.find(c =>
      String(c[0]).includes('SET last_error'),
    )
    expect(errorWriteCall).toBeDefined()
    expect(errorWriteCall?.[1]?.[0]).toContain('boom')
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0][1]).toBe('cloudtalk_sync_customer_failed')
  })
})

describe('deleteCustomerFromCloudTalk', () => {
  it('deletes the cloudtalk contact and the mapping row', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM cloudtalk_contacts'),
        rows: [{ id: 5, cloudtalk_id: 12345 }],
      },
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [{ company_id: 7 }],
      },
      { match: sql => sql.includes('FROM company'), rows: [credsRow] },
    ])
    dbExecute.mockResolvedValue([{}])

    const { deleteCustomerFromCloudTalk } = await import(
      './cloudtalkContactSync.server'
    )
    await deleteCustomerFromCloudTalk(100)

    expect(deleteCloudTalkContact).toHaveBeenCalledWith(7, 12345)
    const deleteCall = dbExecute.mock.calls.find(c =>
      String(c[0]).includes('DELETE FROM cloudtalk_contacts'),
    )
    expect(deleteCall).toBeDefined()
    expect(deleteCall?.[1]).toEqual([5])
  })

  it('still drops the mapping row when CloudTalk returns 404 (already gone)', async () => {
    setupQueries([
      {
        match: sql => sql.includes('FROM cloudtalk_contacts'),
        rows: [{ id: 5, cloudtalk_id: 12345 }],
      },
      {
        match: sql => sql.includes('FROM customers WHERE id = ?'),
        rows: [{ company_id: 7 }],
      },
      { match: sql => sql.includes('FROM company'), rows: [credsRow] },
    ])
    deleteCloudTalkContact.mockRejectedValue(new CloudTalkApiError(404, 'not found'))
    dbExecute.mockResolvedValue([{}])

    const { deleteCustomerFromCloudTalk } = await import(
      './cloudtalkContactSync.server'
    )
    await deleteCustomerFromCloudTalk(100)

    const deleteCall = dbExecute.mock.calls.find(c =>
      String(c[0]).includes('DELETE FROM cloudtalk_contacts'),
    )
    expect(deleteCall).toBeDefined()
    expect(deleteCall?.[1]).toEqual([5])
    expect(captureException).not.toHaveBeenCalled()
  })

  it('is a no-op when no mapping exists', async () => {
    setupQueries([{ match: sql => sql.includes('FROM cloudtalk_contacts'), rows: [] }])

    const { deleteCustomerFromCloudTalk } = await import(
      './cloudtalkContactSync.server'
    )
    await deleteCustomerFromCloudTalk(100)

    expect(deleteCloudTalkContact).not.toHaveBeenCalled()
  })
})
