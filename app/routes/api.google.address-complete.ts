import { data, type LoaderFunctionArgs } from 'react-router'
import type { FinalSuggestion } from '~/services/types'
import { parseAddressFromAutocompleteText } from '~/utils/address'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

if (!GOOGLE_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY is not set')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function mapAutocompleteResponse(body: unknown): FinalSuggestion[] {
  if (!isRecord(body)) return []

  const suggestions = body.suggestions
  if (!Array.isArray(suggestions)) return []

  const results: FinalSuggestion[] = []

  for (const suggestion of suggestions) {
    if (!isRecord(suggestion)) continue

    const placePrediction = suggestion.placePrediction
    if (!isRecord(placePrediction)) continue

    const placeId = getString(placePrediction.placeId)
    const textObj = placePrediction.text
    const text = isRecord(textObj) ? getString(textObj.text) : undefined

    if (!placeId || !text) continue

    results.push({
      place_id: placeId,
      description: { text },
      address: parseAddressFromAutocompleteText(text),
    })
  }

  return results
}

async function fetchPlacePostalCode(
  placeId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const normalizedPlaceId = placeId.replace(/^places\//, '')
  const gRes = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedPlaceId)}`,
    {
      method: 'GET',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'addressComponents,formattedAddress',
      },
    },
  )
  if (!gRes.ok) return null

  const gJson: unknown = await gRes.json()
  if (!isRecord(gJson)) return null

  const components = gJson.addressComponents
  if (Array.isArray(components)) {
    for (const component of components) {
      if (!isRecord(component)) continue
      const types = component.types
      if (!Array.isArray(types) || !types.includes('postal_code')) continue
      return getString(component.longText) ?? getString(component.shortText) ?? null
    }
  }

  const formattedAddress = getString(gJson.formattedAddress)
  if (formattedAddress) {
    const zipMatch = formattedAddress.match(/\b(\d{5}(?:-\d{4})?)\b/)
    return zipMatch?.[1] ?? null
  }

  return null
}

async function fetchPostalCodeFromGeocode(
  addressText: string,
  signal: AbortSignal,
): Promise<string | null> {
  const query = addressText.replace(/,\s*USA\s*$/i, '').trim()
  if (!query) return null

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', query)
  url.searchParams.set('components', 'country:US')
  url.searchParams.set('key', GOOGLE_KEY)

  const gRes = await fetch(url, { signal })
  if (!gRes.ok) return null

  const body: unknown = await gRes.json()
  if (!isRecord(body) || body.status !== 'OK') return null

  const results = body.results
  if (!Array.isArray(results) || results.length === 0) return null

  const first = results[0]
  if (!isRecord(first)) return null

  const components = first.address_components
  if (!Array.isArray(components)) return null

  for (const component of components) {
    if (!isRecord(component)) continue
    const types = component.types
    if (!Array.isArray(types) || !types.includes('postal_code')) continue
    return getString(component.long_name) ?? getString(component.short_name) ?? null
  }

  return null
}

async function enrichWithPostalCodes(
  results: FinalSuggestion[],
  signal: AbortSignal,
): Promise<FinalSuggestion[]> {
  return Promise.all(
    results.map(async result => {
      if (result.address.zip) return result
      let zip = await fetchPlacePostalCode(result.place_id, signal)
      if (!zip) {
        zip = await fetchPostalCodeFromGeocode(result.description.text, signal)
      }
      if (!zip) return result
      return {
        ...result,
        address: { ...result.address, zip },
      }
    }),
  )
}

export async function loader({ request }: LoaderFunctionArgs) {
  const searchParams = new URL(request.url).searchParams
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 3) {
    return []
  }

  if (!GOOGLE_KEY) {
    return []
  }

  const gRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    signal: request.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
    },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ['us'],
    }),
  })

  if (!gRes.ok) {
    return data({ error: 'Google Places Autocomplete error' }, { status: 502 })
  }

  const gJson: unknown = await gRes.json()
  const results = mapAutocompleteResponse(gJson)
  return enrichWithPostalCodes(results, request.signal)
}
