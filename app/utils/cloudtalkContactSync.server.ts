import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import { parseUSAddress } from '~/utils/address'
import {
  CloudTalkApiError,
  type ContactPayload,
  createCloudTalkContact,
  deleteCloudTalkContact,
  findCloudTalkContactByPhone,
  getCloudTalkUSCountryId,
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

const MAX_ERROR_LENGTH = 1000

function loadCustomer(customerId: number) {
  return selectId<CustomerForSync>(
    db,
    `SELECT id, company_id, name, phone, phone_2, email, address, deleted_at
       FROM customers WHERE id = ?`,
    customerId,
  )
}

function loadMapping(customerId: number) {
  return selectId<MappingRow>(
    db,
    'SELECT id, cloudtalk_id FROM cloudtalk_contacts WHERE customer_id = ?',
    customerId,
  )
}

const companiesWithCloudTalk = new Set<number>()

export function resetCompanyHasCloudTalkCache(): void {
  companiesWithCloudTalk.clear()
}

async function companyHasCloudTalk(companyId: number): Promise<boolean> {
  if (companiesWithCloudTalk.has(companyId)) return true
  const creds = await selectId<CompanyCreds>(
    db,
    `SELECT cloudtalk_access_key, cloudtalk_access_secret
       FROM company WHERE id = ?`,
    companyId,
  )
  const hasCreds = Boolean(
    creds?.cloudtalk_access_key && creds?.cloudtalk_access_secret,
  )
  if (hasCreds) companiesWithCloudTalk.add(companyId)
  return hasCreds
}

function buildPhones(customer: CustomerForSync): { public_number: string }[] {
  const phones: { public_number: string }[] = []
  for (const raw of [customer.phone, customer.phone_2]) {
    const e164 = normalizeToE164(raw)
    if (e164) phones.push({ public_number: e164 })
  }
  return phones
}

function buildEmails(customer: CustomerForSync): { email: string }[] {
  const email = customer.email?.trim()
  return email ? [{ email }] : []
}

function buildExternalUrls(customer: CustomerForSync): { name: string; url: string }[] {
  const appUrl = process.env.APP_URL
  if (!appUrl) return []
  return [
    {
      name: 'Granite Manager',
      url: `${appUrl}/employee/customers/info/${customer.id}/info`,
    },
  ]
}

function buildPayload(
  customer: CustomerForSync,
  usCountryId: Nullable<number>,
): Nullable<ContactPayload> {
  const numbers = buildPhones(customer)
  if (numbers.length === 0) return null

  const externalUrls = buildExternalUrls(customer)
  const payload: ContactPayload = {
    name: customer.name,
    ContactNumber: numbers,
    ContactEmail: buildEmails(customer),
  }
  if (externalUrls.length > 0) payload.ExternalUrl = externalUrls

  const parsed = parseUSAddress(customer.address)
  if (parsed) {
    payload.address = parsed.street
    if (parsed.city) payload.city = parsed.city
    if (parsed.state) payload.state = parsed.state
    if (parsed.zip) payload.zip = parsed.zip
    if (parsed.state && parsed.zip && usCountryId !== null) {
      payload.country_id = usCountryId
    }
  }
  return payload
}

async function recordError(customerId: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  try {
    await db.execute<ResultSetHeader>(
      `UPDATE cloudtalk_contacts SET last_error = ? WHERE customer_id = ?`,
      [message.slice(0, MAX_ERROR_LENGTH), customerId],
    )
  } catch (writeError) {
    // biome-ignore lint/suspicious/noConsole: best-effort sync, errors logged for ops
    console.error('Failed to record cloudtalk_contacts.last_error', {
      customerId,
      writeError,
    })
  }
}

async function reportFailure(
  event: 'cloudtalk_sync_customer_failed' | 'cloudtalk_delete_customer_failed',
  customerId: number,
  error: unknown,
): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: best-effort sync, errors logged for ops
  console.error(event, { customerId, error })
  posthogClient.captureException(error, event, { customerId })
  await recordError(customerId, error)
}

async function findLocalCloudTalkIdByPhone(
  companyId: number,
  e164Phones: string[],
): Promise<Nullable<number>> {
  if (e164Phones.length === 0) return null
  const placeholders = e164Phones.map(() => '?').join(',')
  const [rows] = await db.query<(RowDataPacket & { cloudtalk_id: number })[]>(
    `(SELECT cloudtalk_id FROM cloudtalk_contacts
        WHERE company_id = ? AND phone_e164_1 IN (${placeholders}) LIMIT 1)
     UNION ALL
     (SELECT cloudtalk_id FROM cloudtalk_contacts
        WHERE company_id = ? AND phone_e164_2 IN (${placeholders}) LIMIT 1)
     LIMIT 1`,
    [companyId, ...e164Phones, companyId, ...e164Phones],
  )
  return rows[0]?.cloudtalk_id ?? null
}

async function upsertContact(
  customer: CustomerForSync,
  payload: ContactPayload,
  mapping: MappingRow | undefined,
): Promise<void> {
  const phones = payload.ContactNumber.map(n => n.public_number)
  const phone1 = phones[0] ?? null
  const phone2 = phones[1] ?? null

  if (mapping) {
    await updateCloudTalkContact(customer.company_id, mapping.cloudtalk_id, payload)
    await db.execute<ResultSetHeader>(
      `UPDATE cloudtalk_contacts
          SET last_error = NULL, phone_e164_1 = ?, phone_e164_2 = ?
        WHERE id = ?`,
      [phone1, phone2, mapping.id],
    )
    return
  }

  const existingId =
    (await findLocalCloudTalkIdByPhone(customer.company_id, phones)) ??
    (await findCloudTalkContactByPhone(customer.company_id, phones))

  if (existingId) {
    await updateCloudTalkContact(customer.company_id, existingId, payload)
  }
  const cloudtalkId =
    existingId ?? (await createCloudTalkContact(customer.company_id, payload))

  await db.execute<ResultSetHeader>(
    `INSERT INTO cloudtalk_contacts (customer_id, company_id, cloudtalk_id, phone_e164_1, phone_e164_2)
     VALUES (?, ?, ?, ?, ?)`,
    [customer.id, customer.company_id, cloudtalkId, phone1, phone2],
  )
}

export async function syncCustomerToCloudTalk(customerId: number): Promise<void> {
  try {
    const [customer, mapping] = await Promise.all([
      loadCustomer(customerId),
      loadMapping(customerId),
    ])
    if (!customer || customer.deleted_at) return
    if (!(await companyHasCloudTalk(customer.company_id))) return

    const usCountryId = await getCloudTalkUSCountryId(customer.company_id)
    const payload = buildPayload(customer, usCountryId)
    if (!payload) return

    await upsertContact(customer, payload, mapping)
  } catch (error) {
    await reportFailure('cloudtalk_sync_customer_failed', customerId, error)
    throw error
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
      if (!(error instanceof CloudTalkApiError && error.status === 404)) {
        throw error
      }
    }
    await db.execute<ResultSetHeader>(`DELETE FROM cloudtalk_contacts WHERE id = ?`, [
      mapping.id,
    ])
  } catch (error) {
    await reportFailure('cloudtalk_delete_customer_failed', customerId, error)
    throw error
  }
}
