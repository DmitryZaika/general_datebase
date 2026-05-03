import type { ResultSetHeader } from 'mysql2'
import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import {
  CloudTalkApiError,
  type ContactPayload,
  createCloudTalkContact,
  deleteCloudTalkContact,
  findCloudTalkContactByPhone,
  updateCloudTalkContact,
} from '~/utils/cloudtalk.server'
import { normalizeToE164 } from '~/utils/phone'
import { posthogClient } from '~/utils/posthog.server'
import { selectId } from '~/utils/queryHelpers'

interface CustomerForSync {
  id: number
  company_id: number
  name: string
  phone: Nullable<string>
  phone_2: Nullable<string>
  email: Nullable<string>
  address: Nullable<string>
  deleted_at: Nullable<string>
}

interface MappingRow {
  id: number
  cloudtalk_id: number
}

interface CompanyCreds {
  cloudtalk_access_key: Nullable<string>
  cloudtalk_access_secret: Nullable<string>
}

async function loadCustomer(customerId: number) {
  return selectId<CustomerForSync>(
    db,
    `SELECT id, company_id, name, phone, phone_2, email, address, deleted_at
       FROM customers WHERE id = ?`,
    customerId,
  )
}

async function loadMapping(customerId: number) {
  return selectId<MappingRow>(
    db,
    'SELECT id, cloudtalk_id FROM cloudtalk_contacts WHERE customer_id = ?',
    customerId,
  )
}

async function companyHasCloudTalk(companyId: number): Promise<boolean> {
  const creds = await selectId<CompanyCreds>(
    db,
    `SELECT cloudtalk_access_key, cloudtalk_access_secret
       FROM company WHERE id = ?`,
    companyId,
  )
  return Boolean(creds?.cloudtalk_access_key && creds?.cloudtalk_access_secret)
}

function buildPayload(customer: CustomerForSync): Nullable<ContactPayload> {
  const numbers: { public_number: string }[] = []
  for (const raw of [customer.phone, customer.phone_2]) {
    const e164 = normalizeToE164(raw)
    if (e164) numbers.push({ public_number: e164 })
  }
  if (numbers.length === 0) return null

  const emails: { email: string }[] = []
  if (customer.email && customer.email.trim().length > 0) {
    emails.push({ email: customer.email.trim() })
  }

  const externalUrls: { name: string; url: string }[] = []
  const appUrl = process.env.APP_URL
  if (appUrl) {
    externalUrls.push({
      name: 'Granite Manager',
      url: `${appUrl}/employee/customers/info/${customer.id}/info`,
    })
  }

  const payload: ContactPayload = {
    name: customer.name,
    ContactNumber: numbers,
    ContactEmail: emails,
  }
  if (externalUrls.length > 0) payload.ExternalUrl = externalUrls
  if (customer.address && customer.address.trim().length > 0) {
    payload.address = customer.address.trim()
  }
  return payload
}

async function recordError(customerId: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  try {
    await db.execute<ResultSetHeader>(
      `UPDATE cloudtalk_contacts SET last_error = ? WHERE customer_id = ?`,
      [message.slice(0, 1000), customerId],
    )
  } catch (writeError) {
    // biome-ignore lint/suspicious/noConsole: best-effort sync, errors logged for ops
    console.error('Failed to record cloudtalk_contacts.last_error', {
      customerId,
      writeError,
    })
  }
}

export async function syncCustomerToCloudTalk(customerId: number): Promise<void> {
  try {
    const customer = await loadCustomer(customerId)
    if (!customer || customer.deleted_at) return
    if (!(await companyHasCloudTalk(customer.company_id))) return

    const payload = buildPayload(customer)
    if (!payload) return

    const mapping = await loadMapping(customerId)
    if (mapping) {
      await updateCloudTalkContact(customer.company_id, mapping.cloudtalk_id, payload)
      await db.execute<ResultSetHeader>(
        `UPDATE cloudtalk_contacts SET last_error = NULL WHERE id = ?`,
        [mapping.id],
      )
    } else {
      // Avoid creating duplicates if a previous run created the contact on
      // CloudTalk but failed to write the mapping locally, or if the contact
      // was added in CloudTalk by another path. Search by every E164 phone
      // we have, not just the first, so multi-phone customers are matched
      // even when the existing CloudTalk contact only has the secondary number.
      const e164Phones = payload.ContactNumber.map(n => n.public_number)
      const existingId = await findCloudTalkContactByPhone(
        customer.company_id,
        e164Phones,
      )
      let cloudtalkId: number
      if (existingId) {
        await updateCloudTalkContact(customer.company_id, existingId, payload)
        cloudtalkId = existingId
      } else {
        cloudtalkId = await createCloudTalkContact(customer.company_id, payload)
      }
      await db.execute<ResultSetHeader>(
        `INSERT INTO cloudtalk_contacts (customer_id, company_id, cloudtalk_id)
         VALUES (?, ?, ?)`,
        [customer.id, customer.company_id, cloudtalkId],
      )
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: best-effort sync, errors logged for ops
    console.error('CloudTalk contact sync failed', { customerId, error })
    posthogClient.captureException(error, 'cloudtalk_sync_customer_failed', {
      customerId,
    })
    await recordError(customerId, error)
  }
}

export async function deleteCustomerFromCloudTalk(customerId: number): Promise<void> {
  try {
    const mapping = await loadMapping(customerId)
    if (!mapping) return
    const customer = await selectId<{ company_id: number }>(
      db,
      'SELECT company_id FROM customers WHERE id = ?',
      customerId,
    )
    if (!customer) return
    if (!(await companyHasCloudTalk(customer.company_id))) return

    try {
      await deleteCloudTalkContact(customer.company_id, mapping.cloudtalk_id)
    } catch (error) {
      // 404 means the contact is already gone (deleted manually in CloudTalk's
      // UI, retention purge, etc.). Treat that as success so we still drop our
      // stale mapping row instead of leaking it forever.
      if (!(error instanceof CloudTalkApiError && error.status === 404)) {
        throw error
      }
    }
    await db.execute<ResultSetHeader>(`DELETE FROM cloudtalk_contacts WHERE id = ?`, [
      mapping.id,
    ])
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: best-effort sync, errors logged for ops
    console.error('CloudTalk contact delete failed', { customerId, error })
    posthogClient.captureException(error, 'cloudtalk_delete_customer_failed', {
      customerId,
    })
    await recordError(customerId, error)
  }
}
