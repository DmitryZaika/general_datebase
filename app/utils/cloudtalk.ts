import { db } from '~/db.server'
import { selectId } from '~/utils/queryHelpers'

export const BASE_URL = 'https://my.cloudtalk.io/api'

interface CloudtalkResponse<T> {
  itemsCount: number
  pageCount: number
  pageNumber: number
  limit: number
  items: T[]
}

type FavoriteAgent = {
  id: number
  firstname: string
  lastname: string
  fullname: string
  email: string
  language: string
  role: string
  status: string
  default_outbound_number: string
  associated_numbers: string[]
  groups: string[]
}

type Contact = {
  id: number
  name: string
  title: string
  company: string
  industry: string
  website: string
  address: string
  city: string
  zip: string
  state: string
  country_id: number
  favorite_agent: number
  type: string
  created: string
  modified: string
  contact_numbers: string[]
  contact_emails: string[]
  tags: {
    id: number
    name: string
  }[]
  external_urls: {
    external_system: string
    external_url: string
  }[]

  custom_fields: {
    key: string
    value: string
  }[]
}

type Cdr = {
  id: number
  billsec: number
  type: 'incoming' | 'outgoing' | 'internal'
  public_external: string
  public_internal: string
  recorded: boolean
  is_voicemail: boolean
  fax_email: string
  is_redirected: string
  redirected_from: string
  transferred_from: string
  is_local: boolean
  user_id: number
  talking_time: number
  started_at: string
  answered_at: string
  ended_at: string
  waiting_time: number
  wrapup_time: number
  recording_link: number
}

type CallNumber = {
  id: number
  country_code: number
  area_code: number
  internal_name: string
  caller_id_e164: string
  is_redirected: boolean
  connected_to: number
  source_id: number
}

type BillingData = {
  price: number
}

type AgentCall = {
  id: number
  firstname: string
  lastname: string
  fullname: string
  email: string
  language: string
  role: string
  status: string
  default_outbound_number: string
  associated_numbers: string[]
  groups: string[]
}

type CallNote = {
  id: number
  name: string
}[]

export type CallTag = {
  id: number
  name: string
}[]

export type CallRating = {
  id: number
  type: 'agent' | 'contact'
  rating: number
}[]

export type Calls200Response = {
  Cdr: Cdr
  Contact: {
    id: Contact['id']
    name: Contact['name']
    title: Contact['title']
    company: Contact['company']
    industry: Contact['industry']
    address: Contact['address']
    city: Contact['city']
    zip: Contact['zip']
    state: Contact['state']
    type: Contact['type']
    contact_numbers: Contact['contact_numbers']
    contact_emails: Contact['contact_emails']
    tags: Contact['tags']
    external_urls: Contact['external_urls']
    custom_fields: Contact['custom_fields']
    favorite_agent: FavoriteAgent
  }
  CallNumber: {
    id: CallNumber['id']
    internal_name: CallNumber['internal_name']
    caller_id_e164: CallNumber['caller_id_e164']
    country_code: CallNumber['country_code']
    area_code: CallNumber['area_code']
  }
  BillingData: BillingData
  Agent: AgentCall
  Notes: CallNote
  Tags: CallTag
  Ratings: CallRating
}

interface CompanyInfo {
  cloudtalk_access_key: string | null
  cloudtalk_access_secret: string | null
}

export async function getAuthString(companyId: number) {
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

export async function fetchValue<T>(
  url: string,
  companyId: number,
  queryParams: Record<string, string | number>,
): Promise<CloudtalkResponse<T>> {
  const auth = getAuthString(companyId)

  const fullUrl = new URL(`${BASE_URL}/${url}`)

  for (const [key, value] of Object.entries(queryParams)) {
    fullUrl.searchParams.append(key, value.toString())
  }

  const response = await fetch(fullUrl.toString(), {
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
