// app/routes/api.address-autocomplete.ts
import type { LoaderFunctionArgs } from 'react-router'
import { googleAutocomplete } from '~/services/lambda.server'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

if (!GOOGLE_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY is not set')
}

export async function loader({ request }: LoaderFunctionArgs) {
  const searchParams = new URL(request.url).searchParams
  const q = searchParams.get('q')
  if (!q) {
    return null
  }
  return await googleAutocomplete(q)
}
