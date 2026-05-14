import { db } from '~/db.server'
import type { Nullable } from '~/types/utils'
import { normalizeToE164 } from '~/utils/phone'
import { selectId } from '~/utils/queryHelpers'

export const BASE_URL = 'https://my.cloudtalk.io/api'

export interface Agent {
  id: number
  name: string
  firstname: string
  lastname: string
  email: string
  pass: string
  daily_price_limit?: number
  is_daily_limit_ok: boolean
  status_outbound: boolean
  availability_status: 'online' | 'offline' | 'paused' | 'calling'
  extension: number
  call_number_id: number
  default_number: string
  associated_numbers: string[]
}

interface CollectionsResponseEnvelope<T> {
  responseData: {
    itemsCount: number
    pageCount: number
    pageNumber: number
    limit: number
    data: T[]
  }
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
  id: string
  billsec: string
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
  user_id: string
  talking_time: string
  started_at: string
  answered_at: string
  ended_at: string
  waiting_time: string
  wrapup_time: string
  recording_link: string
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

type BillingCall = {
  price: string
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
  BillingCall: BillingCall
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
  return btoa(
    `${companyInfo.cloudtalk_access_key}:${companyInfo.cloudtalk_access_secret}`,
  )
}

export async function fetchValueRaw(
  url: string,
  companyId: number,
  queryParams: Record<string, string | number>,
): Promise<Response> {
  const auth = await getAuthString(companyId)

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

  return response
}

export async function fetchValue<T>(
  url: string,
  companyId: number,
  queryParams: Record<string, string | number>,
): Promise<{ items: T[] }> {
  const response = await fetchValueRaw(url, companyId, queryParams)
  const json = (await response.json()) as CollectionsResponseEnvelope<T>
  return { items: json.responseData?.data ?? [] }
}

export interface ContactPayload {
  name: string
  ContactNumber: { public_number: string }[]
  ContactEmail: { email: string }[]
  ExternalUrl?: { name: string; url: string }[]
  address?: string
  city?: string
  state?: string
  zip?: string
  country_id?: number
}

export class CloudTalkApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'CloudTalkApiError'
  }
}

const MAX_5XX_RETRIES = 3
const MAX_429_RETRIES = 5
const SERVER_BACKOFF_MS = [2000, 4000, 8000]
const POST_CREATE_LOOKUP_RETRIES = 3
const POST_CREATE_LOOKUP_DELAY_MS = 500

type CtMethod = 'PUT' | 'POST' | 'DELETE' | 'GET'

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const jitter = () => Math.floor(Math.random() * 500)

async function cloudtalkRequest(
  path: string,
  companyId: number,
  init: { method: CtMethod; body?: unknown },
): Promise<Response> {
  const auth = await getAuthString(companyId)
  const requestInit: RequestInit = {
    method: init.method,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  }

  let serverAttempt = 0
  let rateLimitAttempt = 0
  while (true) {
    const response = await fetch(`${BASE_URL}/${path}`, requestInit)
    if (response.ok) return response

    if (response.status === 429) {
      if (rateLimitAttempt >= MAX_429_RETRIES) {
        throw new CloudTalkApiError(
          429,
          `CloudTalk rate limit: max retries (${MAX_429_RETRIES}) exceeded`,
        )
      }
      const reset = Number(response.headers.get('X-CloudTalkAPI-ResetTime'))
      const waitMs =
        Number.isFinite(reset) && reset > 0
          ? Math.max(reset * 1000 - Date.now(), 0) + 1000
          : 5000
      await sleep(waitMs + jitter())
      rateLimitAttempt += 1
      continue
    }

    if (response.status >= 500 && serverAttempt < MAX_5XX_RETRIES) {
      await sleep(SERVER_BACKOFF_MS[serverAttempt] + jitter())
      serverAttempt += 1
      continue
    }

    const text = await response.text().catch(() => '')
    throw new CloudTalkApiError(
      response.status,
      `CloudTalk API error: ${response.status} ${response.statusText} ${text}`,
    )
  }
}

interface CloudTalkCountry {
  id?: number | string
  name?: string
  iso_code?: string
  iso?: string
  code?: string
}

interface CountriesEnvelope {
  responseData?: {
    data?: ({ Country?: CloudTalkCountry } | CloudTalkCountry)[]
  }
}

const usCountryIdCache = new Map<number, Nullable<number>>()

function isUnitedStates(country: CloudTalkCountry): boolean {
  const iso = country.iso_code ?? country.iso ?? country.code
  return iso === 'US' || iso === 'USA' || country.name === 'United States'
}

export async function getCloudTalkUSCountryId(
  companyId: number,
): Promise<Nullable<number>> {
  if (usCountryIdCache.has(companyId)) {
    return usCountryIdCache.get(companyId) ?? null
  }
  let resolved: Nullable<number> = null
  try {
    const response = await cloudtalkRequest('countries/index.json', companyId, {
      method: 'GET',
    })
    const json = (await response.json()) as CountriesEnvelope
    for (const item of json.responseData?.data ?? []) {
      const country =
        (item as { Country?: CloudTalkCountry }).Country ?? (item as CloudTalkCountry)
      if (isUnitedStates(country)) {
        const id = coerceId(country.id)
        if (id !== null) {
          resolved = id
          break
        }
      }
    }
  } catch {
    // Endpoint optional per account/plan; omit country tag rather than fail.
  }
  usCountryIdCache.set(companyId, resolved)
  return resolved
}

export function coerceId(value: unknown): Nullable<number> {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) && n > 0 ? n : null
  }
  return null
}

function findContactId(json: unknown): Nullable<number> {
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>
  const responseData = obj.responseData as Record<string, unknown> | undefined
  const data = (responseData?.data ?? obj.data) as Record<string, unknown> | undefined
  const candidates: unknown[] = [
    (data?.Contact as Record<string, unknown> | undefined)?.id,
    data?.id,
    (obj.Contact as Record<string, unknown> | undefined)?.id,
    obj.id,
  ]
  for (const c of candidates) {
    const id = coerceId(c)
    if (id !== null) return id
  }
  return null
}

export async function createCloudTalkContact(
  companyId: number,
  payload: ContactPayload,
): Promise<number> {
  const response = await cloudtalkRequest('contacts/add.json', companyId, {
    method: 'PUT',
    body: payload,
  })
  const json = (await response.json().catch(() => null)) as unknown

  const idFromResponse = findContactId(json)
  if (idFromResponse !== null) return idFromResponse

  // Response shape unfamiliar; the contact still exists with the phone we sent.
  const phone = payload.ContactNumber[0]?.public_number
  if (phone) {
    for (let attempt = 0; attempt < POST_CREATE_LOOKUP_RETRIES; attempt++) {
      await sleep(POST_CREATE_LOOKUP_DELAY_MS)
      const found = await findContactByOnePhone(companyId, phone)
      if (found !== null) return found
    }
  }

  throw new Error(
    `CloudTalk add.json: unable to resolve contact id from response or phone lookup. Response: ${JSON.stringify(json).slice(0, 500)}`,
  )
}

export async function updateCloudTalkContact(
  companyId: number,
  cloudtalkId: number,
  payload: ContactPayload,
): Promise<void> {
  await cloudtalkRequest(`contacts/edit/${cloudtalkId}.json`, companyId, {
    method: 'POST',
    body: payload,
  })
}

export async function deleteCloudTalkContact(
  companyId: number,
  cloudtalkId: number,
): Promise<void> {
  await cloudtalkRequest(`contacts/delete/${cloudtalkId}.json`, companyId, {
    method: 'DELETE',
  })
}

interface ContactSearchHit {
  Contact?: {
    id?: number | string
    contact_numbers?: string[]
    ContactNumber?: { public_number?: string }[]
  }
  id?: number | string
  contact_numbers?: string[]
  ContactNumber?: { public_number?: string }[]
}

interface ContactSearchEnvelope {
  responseData?: { data?: ContactSearchHit[] }
}

function extractPhones(hit: ContactSearchHit): Nullable<string>[] {
  const node = hit.Contact ?? hit
  const phones: Nullable<string>[] = []
  for (const p of node.contact_numbers ?? []) {
    if (typeof p === 'string') phones.push(normalizeToE164(p))
  }
  for (const p of node.ContactNumber ?? []) {
    if (p?.public_number) phones.push(normalizeToE164(p.public_number))
  }
  return phones
}

function extractId(hit: ContactSearchHit): Nullable<number> {
  return coerceId(hit.Contact?.id ?? hit.id)
}

async function findContactByOnePhone(
  companyId: number,
  e164Phone: string,
): Promise<Nullable<number>> {
  const response = await cloudtalkRequest(
    `contacts/index.json?keyword=${encodeURIComponent(e164Phone)}&limit=10`,
    companyId,
    { method: 'GET' },
  )
  const json = (await response.json()) as ContactSearchEnvelope
  for (const hit of json.responseData?.data ?? []) {
    if (extractPhones(hit).includes(e164Phone)) {
      const id = extractId(hit)
      if (id !== null) return id
    }
  }
  return null
}

export async function findCloudTalkContactByPhone(
  companyId: number,
  e164Phones: string[],
): Promise<Nullable<number>> {
  for (const phone of e164Phones) {
    const id = await findContactByOnePhone(companyId, phone)
    if (id) return id
  }
  return null
}

export async function fetchCallsForPhones(
  companyId: number,
  phones: string[],
  extraParams: Record<string, string | number> = {},
): Promise<{ items: Calls200Response[] }> {
  if (phones.length === 0) return { items: [] }

  const results = await Promise.all(
    phones.map(p =>
      fetchValue<Calls200Response>('calls/index.json', companyId, {
        limit: 200,
        ...extraParams,
        public_external: p,
      }),
    ),
  )

  const seen = new Set<string>()
  const items: Calls200Response[] = []
  for (const r of results) {
    for (const item of r.items) {
      if (seen.has(item.Cdr.id)) continue
      seen.add(item.Cdr.id)
      items.push(item)
    }
  }
  return { items }
}
