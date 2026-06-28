import {
  getProductionCalendlyDemoFallback,
  parseCalendlySchedulingUrl,
} from '~/utils/calendlyUrls'

type CalendlyUserResponse = {
  resource?: {
    uri?: string
    scheduling_url?: string
  }
}

type CalendlyEventTypesResponse = {
  collection?: Array<{
    scheduling_url?: string
    active?: boolean
  }>
}

export function getConfiguredCalendlyDemoUrl(): string {
  return (
    parseCalendlySchedulingUrl(process.env.CALENDLY_DEMO_URL) ||
    parseCalendlySchedulingUrl(process.env.VITE_CALENDLY_DEMO_URL) ||
    ''
  )
}

let cachedResolvedUrl: string | null | undefined

export async function resolveCalendlyDemoSchedulingUrl(): Promise<string | null> {
  const configured = getConfiguredCalendlyDemoUrl()
  if (configured) return configured

  if (cachedResolvedUrl) return cachedResolvedUrl

  const fetched = await fetchCalendlyDemoSchedulingUrl()
  if (fetched) {
    cachedResolvedUrl = fetched
    return fetched
  }

  return getProductionCalendlyDemoFallback() || null
}

export function resetCalendlyDemoUrlCache() {
  cachedResolvedUrl = undefined
}

export async function fetchCalendlyDemoSchedulingUrl(): Promise<string | null> {
  const token = process.env.CALENDLY_API_TOKEN?.trim()
  if (!token) return null

  const meResponse = await fetch('https://api.calendly.com/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!meResponse.ok) return null

  const me = (await meResponse.json()) as CalendlyUserResponse
  const userUri = me.resource?.uri
  const userSchedulingUrl = parseCalendlySchedulingUrl(me.resource?.scheduling_url)

  if (!userUri) return userSchedulingUrl || null

  const typesResponse = await fetch(
    `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&active=true&count=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!typesResponse.ok) return userSchedulingUrl || null

  const types = (await typesResponse.json()) as CalendlyEventTypesResponse
  for (const eventType of types.collection ?? []) {
    const schedulingUrl = parseCalendlySchedulingUrl(eventType.scheduling_url)
    if (schedulingUrl) return schedulingUrl
  }

  return userSchedulingUrl || null
}
