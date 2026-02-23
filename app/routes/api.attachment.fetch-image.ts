import type { ActionFunctionArgs } from 'react-router'
import { getEmployeeUser } from '~/utils/session.server'

function isAllowedUrl(url: string, baseOrigin?: string): boolean {
  try {
    const base = baseOrigin?.replace(/\/$/, '') ?? ''
    const resolved =
      (url.startsWith('/') || !url.startsWith('http')) && base
        ? new URL(url.startsWith('/') ? url : `/${url}`, `${base}/`)
        : new URL(url)
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return false
    const host = resolved.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.amazonaws.com')) return true
    if (host.endsWith('gmqtops.com')) return true
    if (process.env.STORAGE_BUCKET && host.includes(process.env.STORAGE_BUCKET))
      return true
    if (base && resolved.origin === base) return true
    return false
  } catch {
    return false
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) {
    return new Response('Invalid or disallowed URL', { status: 400 })
  }
  const baseOrigin =
    request.headers.get('origin') ??
    request.headers.get('referer')?.split('/').slice(0, 3).join('/') ??
    undefined
  if (!isAllowedUrl(rawUrl, baseOrigin)) {
    return new Response('Invalid or disallowed URL', { status: 400 })
  }
  let url = rawUrl
  if ((rawUrl.startsWith('/') || !rawUrl.startsWith('http')) && baseOrigin) {
    try {
      url = new URL(rawUrl, `${baseOrigin}/`).href
    } catch {
      url = `${baseOrigin}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`
    }
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return new Response(`Upstream error: ${res.status}`, { status: 502 })
    }
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const blob = await res.blob()
    const buf = await blob.arrayBuffer()
    return new Response(buf, {
      headers: {
        'Content-Type': contentType,
      },
    })
  } catch {
    return new Response('Failed to fetch image', { status: 502 })
  }
}
