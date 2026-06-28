import type { LoaderFunctionArgs } from 'react-router'
import { fetchCalendlyDemoSchedulingUrl } from '~/utils/calendly.server'
import { parseCalendlySchedulingUrl } from '~/utils/calendlyUrls'

export async function loader(_args: LoaderFunctionArgs) {
  const configuredUrl = parseCalendlySchedulingUrl(process.env.VITE_CALENDLY_DEMO_URL)
  if (configuredUrl) {
    return Response.json({ url: configuredUrl })
  }

  const url = await fetchCalendlyDemoSchedulingUrl()
  return Response.json({ url })
}
