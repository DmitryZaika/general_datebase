import { QueryClientProvider } from '@tanstack/react-query'
import type { RowDataPacket } from 'mysql2'
import { posthog } from 'posthog-js'
import { useEffect, useRef, useState } from 'react'
import type { LinksFunction, LoaderFunctionArgs } from 'react-router'
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
} from 'react-router'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { EmployeeSidebar } from '~/components/molecules/Sidebars/EmployeeSidebar'
import { SidebarProvider } from '~/components/ui/sidebar'
import { db } from '~/db.server'
import { useIsMobile } from '~/hooks/use-mobile'
import { useToast } from '~/hooks/use-toast'
import type { ISupplier } from '~/schemas/suppliers'
import { queryClient } from '~/utils/api'
import { csrf } from '~/utils/csrf.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import {
  getSuperAdminCompanies,
  getUserBySessionId,
  isSuperAdmin,
} from '~/utils/session.server'
import type { ToastMessage } from '~/utils/toastHelpers.server'
import { getBase } from '~/utils/urlHelpers'
import { Header } from './components/Header'
import { Chat } from './components/organisms/Chat'
import { MarketingHeader } from './components/organisms/MarketingHeader'
import { Toaster } from './components/ui/toaster'
import { commitSession, getSession } from './sessions.server'
import './tailwind.css'

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

export function Posthog() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('posthog-js').then(({ default: posthog }) => {
        if (!posthog.__loaded) {
          posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
            api_host: 'https://us.i.posthog.com',
            person_profiles: 'always',
          })
        }
      })
    }
  }, [])

  return null
}

export async function loader({ request }: LoaderFunctionArgs) {
  const [token, cookieHeader] = await csrf.commitToken()
  const session = await getSession(request.headers.get('Cookie'))
  const activeSession = session.data.sessionId || null
  const message: ToastMessage | null = session.get('message') || null

  let user = null
  let companyName: string | null = null
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

      const company = await selectId<{ name: string }>(
        db,
        'SELECT name FROM company WHERE id = ?',
        effectiveCompanyId,
      )
      companyName = company?.name ?? null
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

  if (companyId !== undefined && isContractors && !companyName) {
    const company = await selectId<{ name: string }>(
      db,
      'SELECT name FROM company WHERE id = ?',
      companyId,
    )
    companyName = company?.name ?? null
  }

  let stoneSuppliers: ISupplier[] | undefined
  let sinkSuppliers: ISupplier[] | undefined
  let faucetSuppliers: ISupplier[] | undefined
  let position: string | null = null
  let unreadEmailCount = 0

  const colors = await selectMany<{ id: number; name: string; hex_code: string }>(
    db,
    `SELECT c.id, c.name, c.hex_code
      FROM colors c
      ORDER BY c.name ASC`,
    [],
  )

  if (companyId !== undefined) {
    stoneSuppliers = await selectMany<ISupplier>(
      db,
      `SELECT s.id, s.supplier_name
       FROM suppliers s
       INNER JOIN stones st ON s.id = st.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name`,
      [companyId],
    )

    sinkSuppliers = await selectMany<ISupplier>(
      db,
      `SELECT s.id, s.supplier_name
       FROM suppliers s
       INNER JOIN sink_type sk ON s.id = sk.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name`,
      [companyId],
    )

    faucetSuppliers = await selectMany<ISupplier>(
      db,
      `SELECT s.id, s.supplier_name
       FROM suppliers s
       INNER JOIN faucet_type ft ON s.id = ft.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name`,
      [companyId],
    )
  }

  if (user) {
    const userEmail =
      typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''
    const userEmailLike = `%<${userEmail}>`

    const unreadEmailRows = await selectMany<{ c: number }>(
      db,
      `SELECT COUNT(DISTINCT e.thread_id) AS c
       FROM emails e
       LEFT JOIN (
         SELECT thread_id, MAX(deal_id) AS deal_id
         FROM emails
         WHERE deleted_at IS NULL AND thread_id IS NOT NULL AND deal_id IS NOT NULL
         GROUP BY thread_id
       ) td ON td.thread_id = e.thread_id
       LEFT JOIN deals d ON d.id = COALESCE(e.deal_id, td.deal_id) AND d.deleted_at IS NULL
       WHERE e.deleted_at IS NULL
         AND e.thread_id IS NOT NULL
         AND e.sender_user_id IS NULL
         AND e.employee_read_at IS NULL
         AND (
           e.receiver_user_id = ?
           OR d.user_id = ?
           OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1))) = ?
           OR (e.receiver_email NOT LIKE '%<%' AND LOWER(TRIM(e.receiver_email)) = ?)
           OR e.receiver_email LIKE ?
         )`,
      [user.id, user.id, userEmail, userEmail, userEmailLike],
    )
    unreadEmailCount = unreadEmailRows[0]?.c ?? 0

    const [rows] = await db.query<(RowDataPacket & { position: string })[]>(
      `SELECT p.name AS position
       FROM users u
       LEFT JOIN users_positions up ON up.user_id = u.id
       LEFT JOIN positions p ON p.id = up.position_id
       WHERE u.id = ? AND p.name IN ('external_marketing','check-in','installer','shop_worker') AND u.is_deleted = 0`,
      [user.id],
    )
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

  return data(
    {
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
      unreadEmailCount,
    },

    {
      headers: [
        ['Set-Cookie', cookieHeader || ''],
        ['Set-Cookie', await commitSession(session)],
      ],
    },
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
  const { toast } = useToast()
  const _isMobile = useIsMobile()
  const isLogin = pathname === '/login'
  const isDraw = pathname.startsWith('/employee/draw')
  const isCheckIn = pathname.includes('/check-in')
  const isExternalMarketing = pathname.includes(`/external/marketing/`)
  const isInstallerRoute = pathname.startsWith('/installers')
  const isShopRoute = pathname.startsWith('/shop')
  const isShopWorker = position === 'shop_worker'
  const isContractors = pathname.startsWith('/contractors')
  const isCustomersCompanies = pathname === '/customers/companies'
  const segments = pathname.split('/').filter(Boolean)
  const isCustomerViewPage =
    segments[0] === 'customer' && segments[2] !== 'stones' && segments[2] !== undefined
  const mainRef = useRef<HTMLElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(false)
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      setIsAtBottom(distance <= 8)
    }
    onScroll()
    el.addEventListener('scroll', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
    }
  }, [])
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
  const showSidebar =
    !!basePath &&
    !isLogin &&
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
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <meta charSet='utf-8' />
        <Meta />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <SidebarProvider
            key={showSidebar ? 'show' : 'hide'}
            defaultOpen={showSidebar}
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
                ref={mainRef}
                className='h-screen overflow-y-auto bg-gray-100 w-full'
              >
                {isExternalMarketing ||
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
                  />
                )}
                <div className='relative'>
                  <Outlet />
                </div>
                <Toaster />
                <ScrollRestoration />
                <Scripts />
                <Posthog />
                {!isInstallerRoute && !isCheckIn && user && (
                  <Chat isAtBottom={isAtBottom} />
                )}
                {/* <ScrollToTopButton /> */}
              </main>
            </AuthenticityTokenProvider>
          </SidebarProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
