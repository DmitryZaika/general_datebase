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
  return mapAutocompleteResponse(gJson)
}
