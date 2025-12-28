import { db } from '~/db.server'
import { selectId } from '~/utils/queryHelpers'

const BASE_URL = 'https://my.cloudtalk.io/api'

export interface CloudtalkResponse<T> {
  itemsCount: number
  pageCount: number
  pageNumber: number
  limit: number
  items: T[]
}

interface CompanyInfo {
  cloudtalk_access_key: string | null
  cloudtalk_access_secret: string | null
}

async function getAuthString(companyId: number) {
  const companyInfo = await selectId<CompanyInfo>(
    db,
    'SELECT cloudtalk_access_key, cloudtalk_access_secret FROM company WHERE id = ?',
    companyId,
  )
  if (
    !companyInfo ||
    !companyInfo.cloudtalk_access_key ||
    !companyInfo.cloudtalk_access_secret
  ) {
    throw new Error('CloudTalk API credentials not found')
  }
  return `${companyInfo.cloudtalk_access_key}:${companyInfo.cloudtalk_access_secret}`
}

export async function fetchCalls() {
  const auth = getAuthString(12345)

  const response = await fetch(`${BASE_URL}/calls/index.json`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`CloudTalk API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
