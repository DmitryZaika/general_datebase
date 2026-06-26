import { data, type LoaderFunctionArgs } from 'react-router'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

if (!GOOGLE_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY is not set')
}

function zipFromAddressComponents(
  components:
    | Array<{
        longText?: string
        shortText?: string
        types: string[]
      }>
    | undefined,
): string | undefined {
  return components?.find(component => component.types.includes('postal_code'))
    ?.longText
}

export async function loader({ request }: LoaderFunctionArgs) {
  const searchParams = new URL(request.url).searchParams
  const place_id = searchParams.get('place_id')

  if (!place_id) {
    return data({ error: 'place_id is required' }, { status: 400 })
  }

  const normalizedPlaceId = place_id.replace(/^places\//, '')
  const gRes = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedPlaceId)}`,
    {
      method: 'get',
      signal: request.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents',
      } as HeadersInit,
    },
  )

  if (!gRes.ok) {
    return data({ error: 'Google Places Details error' }, { status: 502 })
  }

  const gJson = (await gRes.json()) as {
    id: string
    displayName: { text: string }
    formattedAddress: string
    addressComponents: Array<{
      longText: string
      shortText: string
      types: string[]
    }>
  }

  const zipCode =
    zipFromAddressComponents(gJson.addressComponents) ??
    gJson.formattedAddress?.match(/\b(\d{5}(?:-\d{4})?)\b/)?.[1]

  // Extract city, state, country
  const city = gJson.addressComponents?.find(component =>
    component.types.includes('locality'),
  )?.longText

  const state = gJson.addressComponents?.find(component =>
    component.types.includes('administrative_area_level_1'),
  )?.shortText

  const country = gJson.addressComponents?.find(component =>
    component.types.includes('country'),
  )?.shortText

  return data({
    place_id: gJson.id,
    name: gJson.displayName?.text,
    formatted_address: gJson.formattedAddress,
    zip_code: zipCode,
    city: city,
    state: state,
    country: country,
    address_components: gJson.addressComponents,
  })
}
