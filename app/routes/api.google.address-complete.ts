// app/routes/api.address-autocomplete.ts
import { data, type LoaderFunctionArgs } from 'react-router'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

if (!GOOGLE_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY is not set')
}

export async function loader({ request }: LoaderFunctionArgs) {
  const searchParams = new URL(request.url).searchParams
  const q = searchParams.get('q')

  const url = new URL('https://places.googleapis.com/v1/places:autocomplete')

  // Field mask for autocomplete response
  const autocompleteHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_KEY || '',
    'X-Goog-FieldMask':
      'suggestions.placePrediction.text,suggestions.placePrediction.placeId',
  }

  // Field mask for place details (zip code comes from addressComponents)
  const detailsHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_KEY || '',
    'X-Goog-FieldMask': 'addressComponents',
  }

  const gRes = await fetch(url, {
    method: 'post',
    signal: request.signal,
    headers: autocompleteHeaders,
    body: JSON.stringify({
      input: q,
      languageCode: 'en',
      includedRegionCodes: ['US'],
    }),
  })
  if (!gRes.ok) {
    return data({ error: 'Google Places error' }, { status: 502 })
  }

  const gJson = (await gRes.json()) as {
    suggestions: {
      placePrediction: {
        text: string | { text: string }
        placeId: string
      }
    }[]
  }

  if (!gJson.suggestions || gJson.suggestions.length === 0) {
    return data({ suggestions: [] })
  }

  const suggestionsWithZipCodes = await Promise.all(
    gJson.suggestions.map(async s => {
      const placeId = s.placePrediction.placeId
      const descriptionText =
        typeof s.placePrediction.text === 'string'
          ? s.placePrediction.text
          : (s.placePrediction.text?.text ?? '')

      const detailsUrl = new URL(`https://places.googleapis.com/v1/places/${placeId}`)
      const detailsRes = await fetch(detailsUrl, {
        method: 'get',
        signal: request.signal,
        headers: detailsHeaders,
      })

      if (detailsRes.ok) {
        const detailsJson = (await detailsRes.json()) as {
          addressComponents?: Array<{
            longText: string
            shortText: string
            types: string[]
          }>
        }

        const zipCode = detailsJson.addressComponents?.find(component =>
          component.types.includes('postal_code'),
        )?.longText

        return {
          description: { text: descriptionText },
          place_id: placeId,
          zip_code: zipCode ?? null,
        }
      }

      return {
        description: { text: descriptionText },
        place_id: placeId,
        zip_code: null,
      }
    }),
  )

  return data({
    suggestions: suggestionsWithZipCodes,
  })
}
