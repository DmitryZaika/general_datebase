import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { loginLogo } from '~/constants/logos'
import {
  getCalendlySchedulingUrl,
  openCalendlyScheduling,
  openDemoSection,
} from '~/utils/calendlyClient'

function loadCalendlyAssets() {
  if (document.querySelector('script[data-calendly]')) return
  const link = document.createElement('link')
  link.href = 'https://assets.calendly.com/assets/external/widget.css'
  link.rel = 'stylesheet'
  document.head.appendChild(link)
  const script = document.createElement('script')
  script.src = 'https://assets.calendly.com/assets/external/widget.js'
  script.async = true
  script.dataset.calendly = 'true'
  document.body.appendChild(script)
}

export function useGraniteManagerCalendly() {
  const location = useLocation()
  const [schedulingUrl, setSchedulingUrl] = useState(() => getCalendlySchedulingUrl())

  useEffect(() => {
    if (schedulingUrl) {
      loadCalendlyAssets()
      return
    }

    let cancelled = false
    void fetch('/api/calendly/scheduling-url')
      .then(response => (response.ok ? response.json() : null))
      .then((data: { url?: string | null } | null) => {
        if (cancelled || !data?.url) return
        setSchedulingUrl(data.url)
        loadCalendlyAssets()
      })

    return () => {
      cancelled = true
    }
  }, [schedulingUrl])

  return useCallback(() => {
    void (async () => {
      let url = schedulingUrl
      if (!url) {
        const response = await fetch('/api/calendly/scheduling-url')
        if (response.ok) {
          const data = (await response.json()) as { url?: string | null }
          if (data.url) {
            url = data.url
            setSchedulingUrl(data.url)
            loadCalendlyAssets()
          }
        }
      }

      if (url) {
        openCalendlyScheduling(url)
        return
      }
      openDemoSection(location.pathname)
    })()
  }, [location.pathname, schedulingUrl])
}

export function graniteManagerHasCalendlyScheduling(): boolean {
  return getCalendlySchedulingUrl().length > 0
}

export function useGraniteManagerCalendlyConfigured() {
  const [configured, setConfigured] = useState(
    () => getCalendlySchedulingUrl().length > 0,
  )

  useEffect(() => {
    if (configured) return
    let cancelled = false
    void fetch('/api/calendly/scheduling-url')
      .then(response => (response.ok ? response.json() : null))
      .then((data: { url?: string | null } | null) => {
        if (cancelled) return
        setConfigured(Boolean(data?.url))
      })
    return () => {
      cancelled = true
    }
  }, [configured])

  return configured
}

export function scrollToMarketingSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function GraniteManagerMarketingHeader({ onDemo }: { onDemo: () => void }) {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'
  const isHomePage = location.pathname === '/'

  return (
    <header className='sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur'>
      <div className='mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6'>
        <Link to='/' className='flex shrink-0 items-center gap-3'>
          <img
            src={loginLogo}
            alt='Granite Manager'
            className='h-10 w-10 object-contain'
          />
          <span className='text-lg font-semibold tracking-tight text-slate-900'>
            Granite Manager
          </span>
        </Link>
        <nav className='flex items-center gap-2 md:gap-4'>
          {isHomePage ? (
            <span className='hidden text-sm font-medium text-slate-900 sm:inline'>
              Main Page
            </span>
          ) : (
            <Link
              to='/'
              className='hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline'
            >
              Main Page
            </Link>
          )}
          {isHomePage ? (
            <button
              type='button'
              onClick={() => scrollToMarketingSection('pricing')}
              className='hidden cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline'
            >
              Pricing
            </button>
          ) : (
            <Link
              to='/#pricing'
              className='hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline'
            >
              Pricing
            </Link>
          )}
          {isLoginPage ? (
            <span className='text-sm font-medium text-slate-900'>Login</span>
          ) : (
            <Link
              to='/login'
              className='text-sm font-medium text-slate-600 hover:text-slate-900'
            >
              Login
            </Link>
          )}
          <button
            type='button'
            onClick={onDemo}
            className='cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
          >
            Get Demo
          </button>
        </nav>
      </div>
    </header>
  )
}

export function GraniteManagerMarketingBackground({
  children,
  className = '',
  fillViewport = false,
}: {
  children: ReactNode
  className?: string
  fillViewport?: boolean
}) {
  return (
    <div
      className={`relative bg-white text-slate-900 ${
        fillViewport ? 'flex min-h-dvh flex-col' : 'min-h-dvh'
      } ${className}`}
    >
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#e2e8f0_0%,_transparent_55%)]' />
      <div
        className={fillViewport ? 'relative flex min-h-0 flex-1 flex-col' : 'relative'}
      >
        {children}
      </div>
    </div>
  )
}
