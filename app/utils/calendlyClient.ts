import {
  DEFAULT_CALENDLY_DEMO_URL,
  parseCalendlySchedulingUrl,
} from '~/utils/calendlyUrls'

export function getCalendlySchedulingUrl(): string {
  return (
    parseCalendlySchedulingUrl(import.meta.env.VITE_CALENDLY_DEMO_URL) ||
    (import.meta.env.PROD ? DEFAULT_CALENDLY_DEMO_URL : '')
  )
}

let calendlyWidgetReady: Promise<void> | null = null

function loadCalendlyWidgetAssets(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (window.Calendly?.initPopupWidget) return Promise.resolve()
  if (calendlyWidgetReady) return calendlyWidgetReady

  calendlyWidgetReady = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.Calendly?.initPopupWidget) {
        resolve()
        return
      }
      reject(new Error('Calendly widget failed to initialize'))
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-calendly]',
    )
    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        finish()
        return
      }
      existingScript.addEventListener('load', finish, { once: true })
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Calendly widget failed to load')),
        { once: true },
      )
      return
    }

    if (!document.querySelector('link[data-calendly]')) {
      const link = document.createElement('link')
      link.href = 'https://assets.calendly.com/assets/external/widget.css'
      link.rel = 'stylesheet'
      link.dataset.calendly = 'true'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    script.dataset.calendly = 'true'
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true'
        finish()
      },
      { once: true },
    )
    script.addEventListener(
      'error',
      () => reject(new Error('Calendly widget failed to load')),
      { once: true },
    )
    document.body.appendChild(script)
  }).catch(error => {
    calendlyWidgetReady = null
    throw error
  })

  return calendlyWidgetReady
}

export async function ensureCalendlyWidgetReady() {
  await loadCalendlyWidgetAssets()
}

export async function openCalendlyScheduling(url: string) {
  try {
    await ensureCalendlyWidgetReady()
    if (window.Calendly?.initPopupWidget) {
      window.Calendly.initPopupWidget({ url })
      return
    }
  } catch {
    // Fall back to opening the scheduling page directly.
  }

  window.location.assign(url)
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
