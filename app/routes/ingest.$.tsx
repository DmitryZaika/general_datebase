import type { ActionFunction, LoaderFunction } from 'react-router'

const API_HOST = 'eu.i.posthog.com'
const ASSET_HOST = 'eu-assets.i.posthog.com'

const posthogProxy = async (request: Request) => {
  const url = new URL(request.url)
  const hostname = url.pathname.startsWith('/ingest/static/') ? ASSET_HOST : API_HOST

  const newUrl = new URL(url)
  newUrl.protocol = 'https'
  newUrl.hostname = hostname
  newUrl.port = '443'
  newUrl.pathname = newUrl.pathname.replace(/^\/ingest/, '')

  const headers = new Headers(request.headers)
  headers.set('host', hostname)

  const response = await fetch(newUrl, {
    method: request.method,
    headers,
    body: request.body,
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export const loader: LoaderFunction = async ({ request }) => posthogProxy(request)

export const action: ActionFunction = async ({ request }) => posthogProxy(request)
