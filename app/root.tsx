import { QueryClientProvider } from '@tanstack/react-query'
import type { RowDataPacket } from 'mysql2'
import { posthog } from 'posthog-js'
import { useEffect } from 'react'
import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from 'react-router'
import {
  data,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useNavigation,
} from 'react-router'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { EmployeeSidebar } from '~/components/molecules/Sidebars/EmployeeSidebar'
import { SidebarProvider } from '~/components/ui/sidebar'
import { db } from '~/db.server'
import { useIsMobile } from '~/hooks/use-mobile'
import { useToast } from '~/hooks/use-toast'
import {
  useScrollMainToTopOnSectionIdle,
  useScrollMainToTopWhenLoading,
} from '~/hooks/useScrollMainToTopWhenLoading'
import type { ISupplier } from '~/schemas/suppliers'
import { canManageCompanySettings } from '~/utils/adminUsersAccess.server'
import { queryClient } from '~/utils/api'
import { renderAppNavigationSkeleton } from '~/utils/appNavigationSkeleton'
import { resolveCalendlyDemoSchedulingUrl } from '~/utils/calendly.server'
import { companyHasCloudTalk } from '~/utils/cloudtalkContactSync.server'
import {
  DEFAULT_COMPANY_LOGO_HEIGHT,
  getHeaderCompanyId,
  resolveCompanyLogoHeight,
} from '~/utils/companyLogo'
import { csrf } from '~/utils/csrf.server'
import {
  getSidebarSection,
  isSidebarSectionChange,
} from '~/utils/employeeSidebarNavigation'
import { selectId, selectMany } from '~/utils/queryHelpers'
import {
  getSuperAdminCompanies,
  getUserBySessionId,
  isSuperAdmin,
} from '~/utils/session.server'
import type { ToastMessage } from '~/utils/toastHelpers.server'
import { getBase } from '~/utils/urlHelpers'
import { Header } from './components/Header'
import { MarketingHeader } from './components/organisms/MarketingHeader'
import { Toaster } from './components/ui/toaster'
import { commitSession, getSession } from './sessions.server'
import './tailwind.css'

const CUSTOM_SKELETON_ROUTES = [
  '/admin/users-activity',
  '/admin/transactions',
  '/admin/surveys',
  '/admin/company',
  '/admin/users',
  '/admin/suppliers',
  '/employee/checklists',
  '/employee/special-order',
  '/employee/instructions',
]

function hasCustomSkeleton(path: string) {
  return CUSTOM_SKELETON_ROUTES.some(route => path.startsWith(route))
}

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap',
  },
  {
    rel: 'icon',
    href: 'https://granite-database.s3.us-east-2.amazonaws.com/static-images/Granite-manager-icon.png',
    type: 'image/png',
  },
  {
    rel: 'apple-touch-icon',
    href: 'https://granite-database.s3.us-east-2.amazonaws.com/static-images/Granite-manager-icon.png',
  },
]

export const meta: MetaFunction = ({ matches }) => {
  const leafMeta = matches[matches.length - 1]?.meta
  let leafTitle = ''
  if (Array.isArray(leafMeta)) {
    for (const m of leafMeta) {
      if ('title' in m && typeof m.title === 'string' && m.title.length > 0) {
        leafTitle = m.title
        break
      }
    }
  }
  return leafTitle
    ? [{ title: `${leafTitle} | Granite Manager` }]
    : [{ title: 'Granite Manager' }]
}

export function Posthog() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('posthog-js').then(({ default: posthog }) => {
        if (!posthog.__loaded) {
          const posthogKey = import.meta.env.VITE_POSTHOG_KEY
          if (!posthogKey) return
          posthog.init(posthogKey, {
            api_host: `${window.location.origin}/ingest`,
            ui_host: 'https://us.posthog.com',
            person_profiles: 'always',
          })
        }
      })
    }
  }, [])

  return null
}

export async function loader({ request }: LoaderFunctionArgs) {
  const [token, cookieHeader] = await csrf.commitToken(request)
  const session = await getSession(request.headers.get('Cookie'))
  const activeSession = session.data.sessionId || null
  const message: ToastMessage | null = session.get('message') || null

  let user = null
  let companyName: string | null = null
  let companyLogoUrl: string | null = null
  let companyLogoHeight: number = DEFAULT_COMPANY_LOGO_HEIGHT
  let companyId: number | undefined

  let superadminCompanies: { id: number; name: string }[] = []
  let activeCompanyId: number | undefined
  let userIsSuperAdmin = false

  if (activeSession) {
    user = (await getUserBySessionId(activeSession)) || null
    if (user) {
      let effectiveCompanyId = user.company_id

      userIsSuperAdmin = await isSuperAdmin(user.id)
      const sessionActiveCompany = session.get('activeCompanyId')
      if (userIsSuperAdmin) {
        superadminCompanies = await getSuperAdminCompanies(user.id)
        if (
          sessionActiveCompany !== undefined &&
          superadminCompanies.some(c => c.id === sessionActiveCompany)
        ) {
          effectiveCompanyId = sessionActiveCompany
          activeCompanyId = sessionActiveCompany
        } else {
          if (sessionActiveCompany !== undefined) {
            session.unset('activeCompanyId')
          }
          if (effectiveCompanyId == null && superadminCompanies.length > 0) {
            effectiveCompanyId = superadminCompanies[0].id
            activeCompanyId = superadminCompanies[0].id
          }
        }
      } else if (sessionActiveCompany !== undefined) {
        session.unset('activeCompanyId')
      }

      companyId = effectiveCompanyId
    }
  }

  const url = new URL(request.url)
  const isContractors = url.pathname.startsWith('/contractors/')

  if (companyId === undefined && isContractors) {
    const parts = url.pathname.split('/')
    if (parts[1] === 'contractors' && parts[2]) {
      const id = parseInt(parts[2], 10)
      if (!Number.isNaN(id)) {
        companyId = id
      }
    }
  }

  const headerCompanyId = getHeaderCompanyId(url.pathname, companyId)
  if (headerCompanyId !== undefined) {
    const company = await selectId<{
      name: string
      logo_url: string | null
      logo_height: number | string | null
    }>(
      db,
      'SELECT name, logo_url, logo_height FROM company WHERE id = ?',
      headerCompanyId,
    )
    companyName = company?.name ?? companyName
    companyLogoUrl = company?.logo_url ?? null
    companyLogoHeight = resolveCompanyLogoHeight(company?.logo_height)
  }

  let position: string | null = null

  const positionPromise = user
    ? db.query<(RowDataPacket & { position: string })[]>(
        `SELECT p.name AS position
         FROM users u
         LEFT JOIN users_positions up ON up.user_id = u.id
         LEFT JOIN positions p ON p.id = up.position_id
         WHERE u.id = ? AND p.name IN ('external_marketing','check-in','installer','shop_worker') AND u.is_deleted = 0`,
        [user.id],
      )
    : Promise.resolve(null)

  const colorsPromise = selectMany<{ id: number; name: string; hex_code: string }>(
    db,
    `SELECT c.id, c.name, c.hex_code
      FROM colors c
      ORDER BY c.name ASC`,
    [],
  )

  const stoneSuppliersPromise =
    companyId !== undefined
      ? selectMany<ISupplier>(
          db,
          `SELECT s.id, s.supplier_name
           FROM suppliers s
           INNER JOIN stones st ON s.id = st.supplier_id
           WHERE s.company_id = ?
           GROUP BY s.id, s.supplier_name`,
          [companyId],
        )
      : Promise.resolve(undefined)

  const sinkSuppliersPromise =
    companyId !== undefined
      ? selectMany<ISupplier>(
          db,
          `SELECT s.id, s.supplier_name
           FROM suppliers s
           INNER JOIN sink_type sk ON s.id = sk.supplier_id
           WHERE s.company_id = ?
           GROUP BY s.id, s.supplier_name`,
          [companyId],
        )
      : Promise.resolve(undefined)

  const faucetSuppliersPromise =
    companyId !== undefined
      ? selectMany<ISupplier>(
          db,
          `SELECT s.id, s.supplier_name
           FROM suppliers s
           INNER JOIN faucet_type ft ON s.id = ft.supplier_id
           WHERE s.company_id = ?
           GROUP BY s.id, s.supplier_name`,
          [companyId],
        )
      : Promise.resolve(undefined)

  const hasCloudtalkApiPromise =
    companyId !== undefined ? companyHasCloudTalk(companyId) : Promise.resolve(false)

  const canManageCompanyPromise = user?.is_admin
    ? canManageCompanySettings(user)
    : Promise.resolve(false)

  const isMarketingPublicPage =
    url.pathname === '/' ||
    url.pathname === '/login' ||
    url.pathname === '/customers/companies'

  const calendlyDemoUrlPromise = isMarketingPublicPage
    ? resolveCalendlyDemoSchedulingUrl()
    : Promise.resolve(null)

  const [
    colors,
    stoneSuppliers,
    sinkSuppliers,
    faucetSuppliers,
    positionResult,
    hasCloudtalkApi,
    canManageCompany,
    calendlyDemoUrl,
  ] = await Promise.all([
    colorsPromise,
    stoneSuppliersPromise,
    sinkSuppliersPromise,
    faucetSuppliersPromise,
    positionPromise,
    hasCloudtalkApiPromise,
    canManageCompanyPromise,
    calendlyDemoUrlPromise,
  ])

  if (user && positionResult) {
    const [rows] = positionResult
    const hasCheckIn = Array.isArray(rows) && rows.some(r => r.position === 'check-in')
    const hasExternalMarketing =
      Array.isArray(rows) && rows.some(r => r.position === 'external_marketing')
    const hasInstaller =
      Array.isArray(rows) && rows.some(r => r.position === 'installer')
    const hasShopWorker =
      Array.isArray(rows) && rows.some(r => r.position === 'shop_worker')
    position = hasCheckIn
      ? 'check-in'
      : hasExternalMarketing
        ? 'external_marketing'
        : hasShopWorker
          ? 'shop_worker'
          : null

    // Installer users: always redirect to their checklist
    if (hasInstaller && !user.is_superuser && !userIsSuperAdmin) {
      const installerTarget = `/installers/${user.company_id}/checklist`
      if (!url.pathname.startsWith('/installers/')) {
        return redirect(installerTarget)
      }
    }

    if (hasCheckIn && !user.is_superuser && !userIsSuperAdmin) {
      const target = `/customer/${user.company_id}/check-in`
      if (!url.pathname.startsWith(target)) {
        return redirect(target)
      }
    }

    // Auto-redirect Marketing users to their External Marketing page
    if (hasExternalMarketing && !user.is_superuser && !userIsSuperAdmin) {
      const marketingTarget = `/external/marketing/${user.company_id}/leads`
      if (!url.pathname.startsWith('/external/marketing/')) {
        return redirect(marketingTarget)
      }
    }
    if (
      hasShopWorker &&
      !user.is_superuser &&
      !userIsSuperAdmin &&
      !url.pathname.startsWith('/shop')
    ) {
      return redirect('/shop/transactions')
    }
  }

  const headers = new Headers()

  if (cookieHeader) {
    headers.append('Set-Cookie', cookieHeader)
  }
  headers.append('Set-Cookie', await commitSession(session))

  return data(
    {
      message,
      token,
      user,
      companyName,
      companyLogoUrl,
      companyLogoHeight,
      stoneSuppliers,
      sinkSuppliers,
      faucetSuppliers,
      colors,
      position,
      superadminCompanies,
      activeCompanyId,
      userIsSuperAdmin,
      hasCloudtalkApi,
      canManageCompany,
      calendlyDemoUrl,
    },

    { headers },
  )
}

export default function App() {
  const {
    message,
    token,
    user,
    companyName,
    stoneSuppliers,
    sinkSuppliers,
    faucetSuppliers,
    colors,
    position,
    superadminCompanies,
    activeCompanyId,
    userIsSuperAdmin,
  } = useLoaderData<typeof loader>()
  const { pathname } = useLocation()
  const navigation = useNavigation()
  const navPath = navigation.location?.pathname ?? ''
  const showSidebarPageSkeleton =
    (pathname.startsWith('/employee') || pathname.startsWith('/admin')) &&
    navigation.state === 'loading' &&
    (navPath.startsWith('/employee') || navPath.startsWith('/admin')) &&
    navPath !== pathname &&
    isSidebarSectionChange(pathname, navPath) &&
    !hasCustomSkeleton(navPath)
  useScrollMainToTopWhenLoading(showSidebarPageSkeleton)
  useScrollMainToTopOnSectionIdle(pathname, navigation.state)
  const sidebarNavigationSkeleton = renderAppNavigationSkeleton(
    getSidebarSection(navPath),
    navPath,
  )
  const { toast } = useToast()
  const _isMobile = useIsMobile()
  const isLogin = pathname === '/login'
  const isLandingPage = pathname === '/'
  const isCustomersCompanies = pathname === '/customers/companies'
  const isMarketingPublicPage = isLandingPage || isLogin || isCustomersCompanies
  const isDraw = pathname.startsWith('/employee/draw')
  const isCheckIn = pathname.includes('/check-in')
  const isExternalMarketing = pathname.includes(`/external/marketing/`)
  const isInstallerRoute = pathname.startsWith('/installers')
  const isShopRoute = pathname.startsWith('/shop')
  const isShopWorker = position === 'shop_worker'
  const isContractors = pathname.startsWith('/contractors')
  const segments = pathname.split('/').filter(Boolean)
  const isCustomerSurveyPage =
    segments[0] === 'customer' && segments.length === 3 && segments[2] === 'survey'
  const isCustomerViewPage =
    segments[0] === 'customer' &&
    segments[2] !== undefined &&
    segments[2] !== 'stones' &&
    segments[2] !== 'sinks' &&
    segments[2] !== 'faucets'
  useEffect(() => {
    if (message !== null && message !== undefined) {
      toast({
        title: message.title,
        description: message.description,
        variant: message.variant,
      })
      if (message.description === 'Logged in' && user) {
        if (typeof window !== 'undefined') {
          posthog.identify(user.email)
        }
      }
    }
  }, [message?.nonce])

  const basePath = getBase(pathname)
  const isEmployeeRoute = pathname.startsWith('/employee')
  const isAdminRoute = pathname.startsWith('/admin')
  const isSidebarPinned = Boolean(user?.pined_bar)
  const sidebarIconHoverShell = (isEmployeeRoute || isAdminRoute) && !isSidebarPinned
  const showSidebar =
    !!basePath &&
    !isMarketingPublicPage &&
    !isInstallerRoute &&
    !isCheckIn &&
    !isExternalMarketing &&
    !(isShopRoute && !isShopWorker) &&
    !isDraw &&
    !isCustomerViewPage &&
    !isCustomersCompanies

  return (
    <html lang='en'>
      <head>
        <meta
          name='viewport'
          content='width=device-width, initial-scale=1.0, viewport-fit=cover'
        />
        <meta charSet='utf-8' />
        <Meta />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <SidebarProvider
            key={showSidebar ? `show-${sidebarIconHoverShell}` : 'hide'}
            defaultOpen={showSidebar && !sidebarIconHoverShell}
          >
            <AuthenticityTokenProvider token={token}>
              {showSidebar && (
                <EmployeeSidebar
                  suppliers={stoneSuppliers}
                  sinkSuppliers={sinkSuppliers}
                  faucetSuppliers={faucetSuppliers}
                  colors={colors}
                />
              )}
              <main
                className={`w-full [scrollbar-gutter:stable] ${
                  isMarketingPublicPage
                    ? 'h-dvh overflow-y-scroll scroll-smooth bg-white'
                    : 'h-screen overflow-y-auto bg-gray-100'
                }`}
              >
                {isMarketingPublicPage ? null : isExternalMarketing ||
                  isCheckIn ||
                  isInstallerRoute ||
                  (isShopRoute && isShopWorker) ||
                  isContractors ? (
                  <MarketingHeader companyName={companyName ?? undefined} />
                ) : (
                  <Header
                    isEmployee={!!user?.is_employee}
                    user={user}
                    isAdmin={!!user?.is_admin}
                    isSuperUser={!!user?.is_superuser}
                    isSuperAdmin={userIsSuperAdmin}
                    superadminCompanies={superadminCompanies}
                    activeCompanyId={activeCompanyId}
                    hideCustomerBurgerMenu={isCustomerSurveyPage}
                  />
                )}
                <div className='relative'>
                  {showSidebarPageSkeleton ? sidebarNavigationSkeleton : <Outlet />}
                </div>
                <Toaster />
                <ScrollRestoration
                  getKey={location => {
                    const section = getSidebarSection(location.pathname)
                    const root = location.pathname.split('/').filter(Boolean)[0]
                    if ((root === 'employee' || root === 'admin') && section) {
                      return `${root}/${section}`
                    }
                    return location.pathname
                  }}
                />
                <Scripts />
                <Posthog />
                {/* <ScrollToTopButton /> */}
              </main>
            </AuthenticityTokenProvider>
          </SidebarProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
