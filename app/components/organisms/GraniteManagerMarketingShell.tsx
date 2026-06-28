import { ArrowRight } from 'lucide-react'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Link, useLocation, useRouteLoaderData } from 'react-router'
import { loginLogo } from '~/constants/logos'
import { cn } from '~/lib/utils'
import {
  ensureCalendlyWidgetReady,
  getCalendlySchedulingUrl,
  openCalendlyScheduling,
  openDemoSection,
} from '~/utils/calendlyClient'

export function MarketingDemoArrow() {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [travelX, setTravelX] = useState(0)

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const button = wrap.closest('button')
    if (!button) return

    const update = () => {
      const buttonRect = button.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      const paddingRight =
        Number.parseFloat(window.getComputedStyle(button).paddingRight) || 0
      const targetLeft = buttonRect.right - paddingRight - wrapRect.width
      setTravelX(Math.max(0, targetLeft - wrapRect.left))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(button)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <span
      ref={wrapRef}
      aria-hidden
      className='relative ml-2 inline-flex h-4 w-4 shrink-0'
      style={{ ['--demo-arrow-travel' as string]: `${travelX}px` }}
    >
      <ArrowRight className='h-4 w-4 transition-all duration-300 ease-out group-hover:translate-x-[var(--demo-arrow-travel)] group-hover:opacity-0' />
      <ArrowRight className='absolute inset-0 h-4 w-4 -translate-x-[var(--demo-arrow-travel)] opacity-0 transition-all duration-300 ease-out group-hover:translate-x-[var(--demo-arrow-travel)] group-hover:opacity-100' />
    </span>
  )
}

type RootLoaderData = {
  calendlyDemoUrl?: string | null
}

function useRootCalendlyDemoUrl(): string {
  const rootData = useRouteLoaderData('root') as RootLoaderData | undefined
  return rootData?.calendlyDemoUrl?.trim() ?? ''
}

export function useGraniteManagerCalendly() {
  const location = useLocation()
  const rootUrl = useRootCalendlyDemoUrl()
  const [fetchedUrl, setFetchedUrl] = useState('')
  const schedulingUrl = rootUrl || getCalendlySchedulingUrl() || fetchedUrl

  useEffect(() => {
    if (!schedulingUrl) {
      let cancelled = false
      void fetch('/api/calendly/scheduling-url')
        .then(response => (response.ok ? response.json() : null))
        .then((data: { url?: string | null } | null) => {
          if (cancelled || !data?.url) return
          setFetchedUrl(data.url)
        })

      return () => {
        cancelled = true
      }
    }

    void ensureCalendlyWidgetReady()
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
            setFetchedUrl(data.url)
          }
        }
      }

      if (url) {
        await openCalendlyScheduling(url)
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
  const rootUrl = useRootCalendlyDemoUrl()
  const [configured, setConfigured] = useState(
    () => rootUrl.length > 0 || getCalendlySchedulingUrl().length > 0,
  )

  useEffect(() => {
    if (configured || rootUrl) {
      setConfigured(true)
      return
    }

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
  }, [configured, rootUrl])

  return configured || rootUrl.length > 0
}

export function scrollToMarketingTop() {
  if (typeof document === 'undefined') return

  const main = document.querySelector('main')
  const scrollBehavior: ScrollBehavior = 'smooth'

  if (main && main.scrollHeight > main.clientHeight + 1) {
    main.scrollTo({ top: 0, behavior: scrollBehavior })
  } else {
    window.scrollTo({ top: 0, behavior: scrollBehavior })
  }

  if (window.location.hash) {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
  }
}

export function scrollToMarketingSection(id: string) {
  const target = document.getElementById(id)
  if (!target) return

  const main = document.querySelector('main')
  const headerOffset = 80

  if (main && main.scrollHeight > main.clientHeight + 1) {
    const top = target.getBoundingClientRect().top + main.scrollTop - headerOffset
    main.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    return
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Reset scroll position when switching marketing routes (avoids jump from carried-over scroll). */
export function useMarketingPageScrollReset() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const main = document.querySelector('main')
    if (main) {
      main.scrollTop = 0
    }
    window.scrollTo(0, 0)
  }, [pathname])
}

export function MarketingSlideDown({
  children,
  className,
  delay = 0,
  whenVisible = false,
}: {
  children: ReactNode
  className?: string
  /** Stagger delay in ms before the animation starts. */
  delay?: number
  /** Wait until the element enters the viewport (for below-the-fold sections). */
  whenVisible?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!whenVisible) {
      const timer = setTimeout(() => setVisible(true), 80 + delay)
      return () => clearTimeout(timer)
    }

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setTimeout(() => setVisible(true), delay)
        observer.disconnect()
      },
      { threshold: 0.12 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [delay, whenVisible])

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-out',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-5 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function GraniteManagerMarketingHeader({ onDemo }: { onDemo: () => void }) {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'
  const isHomePage = location.pathname === '/'

  return (
    <>
      <header className='fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur'>
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
              <button
                type='button'
                onClick={scrollToMarketingTop}
                className='hidden cursor-pointer text-sm font-medium text-slate-900 sm:inline'
              >
                Main Page
              </button>
            ) : (
              <Link
                to='/'
                className='hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline'
              >
                Main Page
              </Link>
            )}
            <a
              href='https://docs.granite-manager.com/'
              target='_blank'
              rel='noopener noreferrer'
              className='hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline'
            >
              Documentation
            </a>
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
              className='group inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
            >
              Get Demo
              <MarketingDemoArrow />
            </button>
          </nav>
        </div>
      </header>
      <div className='h-[65px] shrink-0' aria-hidden />
    </>
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
  useMarketingPageScrollReset()

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
