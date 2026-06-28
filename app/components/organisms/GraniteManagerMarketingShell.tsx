import { ArrowRight, Menu, X } from 'lucide-react'
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

export function MarketingDemoButtonLabel({ variant }: { variant: 'free' | 'short' }) {
  if (variant === 'free') {
    return (
      <>
        Get a Free Dem<span data-demo-o>o</span>
      </>
    )
  }

  return (
    <>
      Get Dem<span data-demo-o>o</span>
    </>
  )
}

export function MarketingDemoArrow() {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [travelEnd, setTravelEnd] = useState(0)
  const [enterStart, setEnterStart] = useState(0)

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const button = wrap.closest('button')
    if (!button) return

    const update = () => {
      const buttonRect = button.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      const nextTravelEnd = buttonRect.right - wrapRect.left
      setTravelEnd(Math.max(0, nextTravelEnd))

      const oMark = button.querySelector('[data-demo-o]')
      if (oMark instanceof HTMLElement) {
        const oRect = oMark.getBoundingClientRect()
        setEnterStart(oRect.left - wrapRect.left)
        return
      }

      setEnterStart(-nextTravelEnd)
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
      style={{
        ['--demo-arrow-travel-end' as string]: `${travelEnd}px`,
        ['--demo-arrow-enter-start' as string]: `${enterStart}px`,
      }}
    >
      <ArrowRight className='h-4 w-4 transition-all duration-300 ease-out group-hover:translate-x-[var(--demo-arrow-travel-end)] group-hover:opacity-0' />
      <ArrowRight className='absolute inset-0 h-4 w-4 translate-x-[var(--demo-arrow-enter-start)] opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-150' />
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

function useHomeSection(): 'main' | 'pricing' {
  const [section, setSection] = useState<'main' | 'pricing'>('main')

  useEffect(() => {
    const pricing = document.getElementById('pricing')
    if (!pricing) return

    const main = document.querySelector('main')
    const scroller = main && main.scrollHeight > main.clientHeight + 1 ? main : null

    const update = () => {
      const pricingRect = pricing.getBoundingClientRect()
      const viewportHeight = scroller ? scroller.clientHeight : window.innerHeight
      const scrollTop = scroller ? scroller.scrollTop : window.scrollY
      const pricingTop =
        scrollTop +
        pricingRect.top -
        (scroller ? scroller.getBoundingClientRect().top : 0)
      const activationPoint = pricingTop - viewportHeight + 1

      setSection(scrollTop >= activationPoint ? 'pricing' : 'main')
    }

    const scrollTarget = scroller ?? window
    scrollTarget.addEventListener('scroll', update, { passive: true })
    update()
    return () => scrollTarget.removeEventListener('scroll', update)
  }, [])

  return section
}

export function GraniteManagerMarketingHeader({ onDemo }: { onDemo: () => void }) {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'
  const isHomePage = location.pathname === '/'
  const homeSection = useHomeSection()
  const atPricing = isHomePage && homeSection === 'pricing'
  const atMain = isHomePage && homeSection === 'main'

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const navUnderline =
    "relative pb-1 before:absolute before:inset-x-0 before:bottom-0 before:h-[3px] before:origin-right before:scale-x-0 before:bg-black before:transition-transform before:duration-300 before:ease-out before:content-[''] hover:before:origin-left hover:before:scale-x-100"
  const navUnderlineActive = 'before:origin-left before:scale-x-100'

  return (
    <>
      <header className='fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur'>
        {/* Mobile: burger menu on right, Get Demo centered */}
        <div className='mx-auto grid max-w-6xl grid-cols-3 items-center px-2 py-3 md:hidden'>
          <Link to='/' className='flex shrink-0 items-center gap-3 justify-self-start'>
            <img
              src={loginLogo}
              alt='Granite Manager'
              className='h-10 w-10 object-contain'
            />
          </Link>

          <button
            type='button'
            onClick={onDemo}
            className='cursor-pointer justify-self-center rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800'
          >
            Get Demo
          </button>

          <div className='relative justify-self-end'>
            <button
              type='button'
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className='flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            >
              {mobileMenuOpen ? (
                <X className='h-5 w-5' />
              ) : (
                <Menu className='h-5 w-5' />
              )}
            </button>

            <div
              className={cn(
                'absolute right-0 top-12 z-50 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg transition-all duration-300 ease-out',
                mobileMenuOpen
                  ? 'translate-x-0 opacity-100'
                  : 'pointer-events-none translate-x-4 opacity-0',
              )}
            >
              <nav className='flex flex-col gap-0.5'>
                {isHomePage ? (
                  <button
                    type='button'
                    onClick={() => {
                      scrollToMarketingTop()
                      setMobileMenuOpen(false)
                    }}
                    className={cn(
                      'cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-50',
                      atMain && 'text-slate-900',
                    )}
                  >
                    Main Page
                  </button>
                ) : (
                  <Link
                    to='/'
                    onClick={() => setMobileMenuOpen(false)}
                    className='rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  >
                    Main Page
                  </Link>
                )}

                {isHomePage ? (
                  <button
                    type='button'
                    onClick={() => {
                      scrollToMarketingSection('pricing')
                      setMobileMenuOpen(false)
                    }}
                    className={cn(
                      'cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-50',
                      atPricing && 'text-slate-900',
                    )}
                  >
                    Pricing
                  </button>
                ) : (
                  <Link
                    to='/#pricing'
                    onClick={() => setMobileMenuOpen(false)}
                    className='rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  >
                    Pricing
                  </Link>
                )}

                {isLoginPage ? (
                  <span className='rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-900'>
                    Login
                  </span>
                ) : (
                  <Link
                    to='/login'
                    onClick={() => setMobileMenuOpen(false)}
                    className='rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  >
                    Login
                  </Link>
                )}

                <a
                  href='https://docs.granite-manager.com/'
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={() => setMobileMenuOpen(false)}
                  className='rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                >
                  Documentation
                </a>
              </nav>
            </div>
          </div>
        </div>

        {/* Desktop: nav on the right */}
        <div className='mx-auto hidden max-w-6xl items-center justify-between gap-4 px-2 py-3 md:flex md:px-6'>
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

          <nav className='flex items-center gap-4'>
            {isHomePage ? (
              <button
                type='button'
                onClick={scrollToMarketingTop}
                className={cn(
                  'cursor-pointer text-sm font-medium',
                  navUnderline,
                  atMain && navUnderlineActive,
                )}
              >
                Main Page
              </button>
            ) : (
              <Link
                to='/'
                className={cn(
                  'text-sm font-medium text-slate-600 hover:text-slate-900',
                  navUnderline,
                )}
              >
                Main Page
              </Link>
            )}

            {isHomePage ? (
              <button
                type='button'
                onClick={() => scrollToMarketingSection('pricing')}
                className={cn(
                  'cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900',
                  navUnderline,
                  atPricing && navUnderlineActive,
                )}
              >
                Pricing
              </button>
            ) : (
              <Link
                to='/#pricing'
                className={cn(
                  'text-sm font-medium text-slate-600 hover:text-slate-900',
                  navUnderline,
                )}
              >
                Pricing
              </Link>
            )}

            {isLoginPage ? (
              <span
                className={cn(
                  'text-sm font-medium text-slate-900',
                  navUnderline,
                  navUnderlineActive,
                )}
              >
                Login
              </span>
            ) : (
              <Link
                to='/login'
                className={cn(
                  'text-sm font-medium text-slate-600 hover:text-slate-900',
                  navUnderline,
                )}
              >
                Login
              </Link>
            )}

            <button
              type='button'
              onClick={onDemo}
              className='cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800'
            >
              Get Demo
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
