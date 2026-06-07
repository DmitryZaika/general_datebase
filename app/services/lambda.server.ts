import type { TemplateVariableData } from '~/services/types'

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

export async function syncCustomerToCloudTalk(
  companyId: number,
  customerId: number,
): Promise<string> {
  const response = await fetchFromLambda(`cloudtalk/sync/${companyId}/${customerId}`)
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
  customerId: number | null,
): Promise<TemplateVariableData> {
  // 1. Build the optional query parameters
  const params = new URLSearchParams()
  if (dealId !== null) params.append('dealId', dealId.toString())
  if (customerId !== null) params.append('customerId', customerId.toString())

  // 2. Append the query string to the path if parameters exist
  const queryString = params.toString()
  const path = queryString
    ? `template/variables/${userId}?${queryString}`
    : `template/variables/${userId}`

  // 3. Make the request
  const response = await fetchFromLambda(path)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch template variables for user ${userId}: ${response.statusText}`,
    )
  }

  return await response.json()
}
