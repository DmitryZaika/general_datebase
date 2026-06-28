export function parseCalendlySchedulingUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase()
    if (host === 'calendly.com' || host.endsWith('.calendly.com')) {
      return `${url.origin}${url.pathname}`.replace(/\/$/, '')
    }
  } catch {
    return ''
  }

  return ''
}
