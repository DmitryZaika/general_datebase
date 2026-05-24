async function fetchFromLambda<T, V>(
  path: string,
  data: T | undefined = undefined,
): Promise<V> {
  const url = `${process.env.LAMBDA_URL}/${path}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  return (await response.json()) as V
}

export async function syncCustomerToCloudTalk(
  companyId: number,
  customerId: number,
): Promise<string> {
  return await fetchFromLambda(`/cloudtalk/sync/${companyId}/${customerId}`)
}
