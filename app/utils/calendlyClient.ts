import { parseCalendlySchedulingUrl } from '~/utils/calendlyUrls'

export function getCalendlySchedulingUrl(): string {
  return parseCalendlySchedulingUrl(import.meta.env.VITE_CALENDLY_DEMO_URL)
}

export function openCalendlyScheduling(url: string) {
  if (window.Calendly?.initPopupWidget) {
    window.Calendly.initPopupWidget({ url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function openDemoSection(pathname: string) {
  if (pathname === '/') {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
    return
  }
  window.location.href = '/#demo'
}

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (options: { url: string }) => void
    }
  }
}
