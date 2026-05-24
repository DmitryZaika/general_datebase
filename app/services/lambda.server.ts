async function fetchFromLambda<T>(
  path: string,
  data: T | undefined = undefined,
): Promise<Response> {
  const url = `${process.env.LAMBDA_URL}/${path}`
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
}

export async function syncCustomerToCloudTalk(
  companyId: number,
  customerId: number,
): Promise<string> {
  const response = await fetchFromLambda(`/cloudtalk/sync/${companyId}/${customerId}`)
  if (!response.ok) {
    throw new Error(
      `Failed to sync customer ${customerId} to CloudTalk: ${response.statusText}`,
    )
  }
  return await response.text()
}
