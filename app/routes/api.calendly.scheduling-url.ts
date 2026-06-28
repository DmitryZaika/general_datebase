import type { LoaderFunctionArgs } from 'react-router'
import { resolveCalendlyDemoSchedulingUrl } from '~/utils/calendly.server'

export async function loader(_args: LoaderFunctionArgs) {
  const url = await resolveCalendlyDemoSchedulingUrl()
  return Response.json({ url })
}
