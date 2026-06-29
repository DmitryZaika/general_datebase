import type { ResultSetHeader } from 'mysql2'
import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import { CloudTalkApiError, deleteCloudTalkContact } from '~/utils/cloudtalk.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectId } from '~/utils/queryHelpers'

interface MappingRow {
  id: number
  cloudtalk_id: number
}

interface CompanyCreds {
  cloudtalk_access_key: Nullable<string>
  cloudtalk_access_secret: Nullable<string>
}

const MAX_ERROR_LENGTH = 1000

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

export async function companyHasCloudTalk(companyId: number): Promise<boolean> {
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
  event: 'cloudtalk_delete_customer_failed',
  customerId: number,
  error: unknown,
): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: best-effort sync, errors logged for ops
  console.error(event, { customerId, error })
  posthogClient.captureException(error, event, { customerId })
  await recordError(customerId, error)
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
