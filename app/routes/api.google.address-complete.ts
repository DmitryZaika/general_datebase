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

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_KEY || '',
  }

  const gRes = await fetch(url, {
    method: 'post',
    signal: request.signal,
    headers,
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
    suggestions: { placePrediction: { text: string; placeId: string } }[]
  }

  if (gJson.suggestions === undefined || gJson.suggestions.length === 0) {
    return data({ suggestions: [] })
  }

  // Optionally fetch zip codes for each suggestion
  const suggestionsWithZipCodes = await Promise.all(
    gJson.suggestions.map(async s => {
      // Fetch place details to get zip code
      const detailsUrl = new URL(
        `https://places.googleapis.com/v1/places/${s.placePrediction.placeId}`,
      )
      const detailsRes = await fetch(detailsUrl, {
        method: 'get',
        signal: request.signal,
        headers,
      })

      if (detailsRes.ok) {
        const detailsJson = (await detailsRes.json()) as {
          addressComponents: Array<{
            longText: string
            shortText: string
            types: string[]
          }>
        }

        const zipCode = detailsJson.addressComponents?.find(component =>
          component.types.includes('postal_code'),
        )?.longText

        return {
          description: s.placePrediction.text,
          place_id: s.placePrediction.placeId,
          zip_code: zipCode,
        }
      }

      // Fallback if details fetch fails
      return {
        description: s.placePrediction.text,
        place_id: s.placePrediction.placeId,
        zip_code: null,
      }
    }),
  )

  return data({
    suggestions: suggestionsWithZipCodes,
  })
}
