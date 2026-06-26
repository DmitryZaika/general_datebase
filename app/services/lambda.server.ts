import { db } from '~/db.server'
import { companyHasCloudTalk } from '~/utils/cloudtalkContactSync.server'
import { selectId } from '~/utils/queryHelpers'

async function fetchFromLambda<T>(
  path: string,
  data: T | undefined = undefined,
): Promise<Response> {
  const url = `${process.env.LAMBDA_URL}/${path}`
  if (!process.env.LAMBDA_KEY) throw new Error('LAMBDA_KEY not set')
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',

      Authorization: process.env.LAMBDA_KEY,
    },
    body: JSON.stringify(data),
  })
}

function hasPhone(phone?: string | null, phone2?: string | null): boolean {
  return Boolean(phone?.trim() || phone2?.trim())
}

export async function syncCustomerToCloudTalk(
  companyId: number,
  customerId: number,
): Promise<string | null> {
  if (!(await companyHasCloudTalk(companyId))) return null

  const customer = await selectId<{ phone: string | null; phone_2: string | null }>(
    db,
    'SELECT phone, phone_2 FROM customers WHERE id = ? AND company_id = ? AND deleted_at IS NULL',
    [customerId, companyId],
  )
  if (!customer || !hasPhone(customer.phone, customer.phone_2)) return null

  const response = await fetchFromLambda(`cloudtalk/sync/${companyId}/${customerId}`)
  if (!response.ok) {
    throw new Error(
      `Failed to sync customer ${customerId} to CloudTalk: ${response.statusText}`,
    )
  }
  return await response.text()
}
