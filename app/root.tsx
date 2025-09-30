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
import {
  OriginalSidebarTrigger,
  SidebarProvider,
  SidebarTrigger,
} from '~/components/ui/sidebar'
import { db } from '~/db.server'
import { useIsMobile } from '~/hooks/use-mobile'
import type { ISupplier } from '~/schemas/suppliers'
import { csrf } from '~/utils/csrf.server'
import { getBase } from '~/utils/urlHelpers'
import { Header } from './components/Header'
import { Chat } from './components/organisms/Chat'
import { Toaster } from './components/ui/toaster'
import { useToast } from './hooks/use-toast'
import { commitSession, getSession } from './sessions'
import './tailwind.css'
import { queryClient } from './utils/api'
import { selectMany } from './utils/queryHelpers'
import { getUserBySessionId } from './utils/session.server'
import type { ToastMessage } from './utils/toastHelpers'

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
  if (activeSession) {
    user = (await getUserBySessionId(activeSession)) || null
  }

  let stoneSuppliers: ISupplier[] | undefined
  let sinkSuppliers: ISupplier[] | undefined
  let faucetSuppliers: ISupplier[] | undefined
  let position: string | null = null

  const colors = await selectMany<{ id: number; name: string; hex_code: string }>(
    db,
    `SELECT c.id, c.name, c.hex_code
      FROM colors c
      ORDER BY c.name ASC`,
    [],
  )

  if (user) {
    stoneSuppliers = await selectMany<ISupplier>(
      db,
      `SELECT s.id, s.supplier_name
       FROM suppliers s
       INNER JOIN stones st ON s.id = st.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name`,
      [user.company_id],
    )

    sinkSuppliers = await selectMany<ISupplier>(
      db,
      `SELECT s.id, s.supplier_name
       FROM suppliers s
       INNER JOIN sink_type sk ON s.id = sk.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name`,
      [user.company_id],
    )

    faucetSuppliers = await selectMany<ISupplier>(
      db,
      `SELECT s.id, s.supplier_name
       FROM suppliers s
       INNER JOIN faucet_type ft ON s.id = ft.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name`,
      [user.company_id],
    )

    const [rows] = await db.query<(RowDataPacket & { position: string })[]>(
      `SELECT p.name AS position
       FROM users u
       LEFT JOIN users_positions up ON up.user_id = u.id
       LEFT JOIN positions p ON p.id = up.position_id
       WHERE u.id = ? AND p.name IN ('external_marketing','check-in') AND u.is_deleted = 0`,
      [user.id],
    )
    const hasCheckIn = Array.isArray(rows) && rows.some(r => r.position === 'check-in')
    const hasExternalMarketing =
      Array.isArray(rows) && rows.some(r => r.position === 'external_marketing')
    position = hasCheckIn
      ? 'check-in'
      : hasExternalMarketing
        ? 'external_marketing'
        : null

    const url = new URL(request.url)
    if (hasCheckIn) {
      const target = `/customer/${user.company_id}/check-in`
      if (!url.pathname.startsWith(target)) {
        return redirect(target)
      }
    } else if (hasExternalMarketing) {
      if (!url.pathname.startsWith('/external/marketing')) {
        return redirect('/external/marketing/leads')
      }
    }
  }

  return data(
    {
      message,
      token,
      user,
      stoneSuppliers,
      sinkSuppliers,
      faucetSuppliers,
      colors,
      position,
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
    stoneSuppliers,
    sinkSuppliers,
    faucetSuppliers,
    colors,
    position,
  } = useLoaderData<typeof loader>()
  const { pathname } = useLocation()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const isLogin = pathname === '/login'
  const isDraw = pathname.startsWith('/employee/draw')
  const isCheckIn = pathname.includes('/check-in')
  const isExternalMarketing = pathname.includes('/external/marketing')
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
  const isInstaller = position !== null
  const showSidebar =
    !!basePath &&
    !isLogin &&
    !isInstaller &&
    !isCheckIn &&
    !isExternalMarketing &&
    !isDraw

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
          <SidebarProvider defaultOpen={showSidebar}>
            {showSidebar && (
              <EmployeeSidebar
                suppliers={stoneSuppliers}
                sinkSuppliers={sinkSuppliers}
                faucetSuppliers={faucetSuppliers}
                colors={colors}
              />
            )}
            <main ref={mainRef} className='h-screen overflow-y-auto bg-gray-100 w-full'>
              <AuthenticityTokenProvider token={token}>
                {!isInstaller && !isCheckIn && (
                  <Header
                    isEmployee={user?.is_employee ?? false}
                    user={user}
                    isAdmin={user?.is_admin ?? false}
                    isSuperUser={user?.is_superuser ?? false}
                  />
                )}
                <div className='relative'>
                  {isMobile && !isCheckIn && <SidebarTrigger />}
                  {!isMobile && !isCheckIn && <OriginalSidebarTrigger />}
                  <Outlet />
                </div>
              </AuthenticityTokenProvider>
              <Toaster />
              <ScrollRestoration />
              <Scripts />
              <Posthog />
              {!isInstaller && user && <Chat isAtBottom={isAtBottom} />}
              {/* <ScrollToTopButton /> */}
            </main>
          </SidebarProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
