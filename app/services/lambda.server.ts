import type { TemplateVariableData } from '~/services/types'

async function fetchFromLambda<T>(
  path: string,
  method: 'GET' | 'POST',
  data: T | undefined = undefined,
): Promise<Response> {
  const baseUrl = (process.env.LAMBDA_URL ?? '').replace(/\/$/, '')
  const url = `${baseUrl}/${path}`
  if (!process.env.REMIX_KEY) throw new Error('REMIX_KEY not set')
  return await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',

      Authorization: process.env.REMIX_KEY,
    },
    body: JSON.stringify(data),
  })
}

export async function syncCustomerToCloudTalk(
  companyId: number,
  customerId: number,
): Promise<string> {
  const response = await fetchFromLambda(
    `cloudtalk/sync/${companyId}/${customerId}`,
    'POST',
  )
  if (!response.ok) {
    throw new Error(
      `Failed to sync customer ${customerId} to CloudTalk: ${response.statusText}`,
    )
  }
  return await response.text()
}

export async function fetchTemplateVariableData(
  userId: number,
  dealId: number | null,
  companyId: number,
  customerId: number | null,
): Promise<TemplateVariableData> {
  // 1. Build the optional query parameters
  const params = new URLSearchParams()
  if (dealId !== null) params.append('dealId', dealId.toString())
  if (customerId !== null) params.append('customerId', customerId.toString())

  // 2. Append the query string to the path if parameters exist
  const queryString = params.toString()
  const path = queryString
    ? `template/variables/${companyId}/${userId}?${queryString}`
    : `template/variables/${companyId}/${userId}`

  // 3. Make the request
  const response = await fetchFromLambda(path, 'GET')

  if (!response.ok) {
    throw new Error(
      `Failed to fetch template variables for user ${userId}: ${response.statusText}`,
    )
  }

  return await response.json()
}

export async function replaceTemplateVariables(
  userId: number,
  dealId: number | null,
  companyId: number,
  customerId: number | null,
  template: string,
): Promise<string> {
  // 1. Build the optional query parameters
  const params = new URLSearchParams()
  if (dealId !== null) params.append('dealId', dealId.toString())
  if (customerId !== null) params.append('customerId', customerId.toString())

  // 2. Append the query string to the path if parameters exist
  const queryString = params.toString()
  const path = queryString
    ? `template/complete/${companyId}/${userId}?${queryString}`
    : `template/complete/${companyId}/${userId}`

  // 3. Make the request
  const response = await fetchFromLambda(path, 'POST', { template })

  if (!response.ok) {
    throw new Error(
      `Failed to replace template variables for user ${userId}: ${response.statusText}`,
    )
  }

  return await response.text()
}
