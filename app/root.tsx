import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { posthog } from 'posthog-js'
import { useEffect } from 'react'
import type { LinksFunction, LoaderFunctionArgs } from 'react-router'
import {
  data, Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData, useLocation
} from 'react-router'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { EmployeeSidebar } from '~/components/molecules/Sidebars/EmployeeSidebar'
import { ScrollToTopButton } from '~/components/ui/ScrollToTopButton'
import { SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar'
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
]

export function Posthog() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('posthog-js')
        .then(({ default: posthog }) => {
          if (!posthog.__loaded) {
            posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
              api_host: 'https://us.i.posthog.com',
              person_profiles: 'always',
            })
          }
        })
        .catch(console.error)
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

  let stoneSuppliers: ISupplier[] | undefined = undefined;
  let sinkSuppliers: ISupplier[] | undefined = undefined;
  let faucetSuppliers: ISupplier[] | undefined = undefined;
  let colors: { id: number; name: string; hex_code: string }[] | undefined =
    undefined;
  let position: string | null = null;

  colors = await selectMany<{ id: number; name: string; hex_code: string }>(
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
      [user.company_id]
    );

    const [[row]]: any = await db.query(
      `SELECT p.name AS position FROM users u LEFT JOIN positions p ON p.id = u.position_id WHERE u.id = ? LIMIT 1`,
      [user.id],
    );
    position = row?.position ?? null;
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

const queryClient = new QueryClient()

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
  } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isLogin = pathname === "/login";
  const isCheckIn = pathname.includes("/check-in");

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

  const basePath = getBase(pathname);
  const isInstaller = position === "installer";
  const showSidebar = !!basePath && !isLogin && !isInstaller && !isCheckIn;

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
          <SidebarProvider open={showSidebar}>
            {showSidebar && (
              <EmployeeSidebar
                suppliers={stoneSuppliers}
                sinkSuppliers={sinkSuppliers}
                faucetSuppliers={faucetSuppliers}
                colors={colors}
              />
            )}
            <main className="h-screen overflow-y-auto bg-gray-100 w-full">
              <AuthenticityTokenProvider token={token}>
                {!isInstaller && (
                  <Header
                    isEmployee={user?.is_employee ?? false}
                    user={user}
                    isAdmin={user?.is_admin ?? false}
                    isSuperUser={user?.is_superuser ?? false}
                  />
                )}
                <div className="relative">
                  {isMobile && !isCheckIn && <SidebarTrigger />}
                  <Outlet />
                </div>
              </AuthenticityTokenProvider>
              <Toaster />
              <ScrollRestoration />
              <Scripts />
              <Posthog />
              {!isInstaller && user && <Chat />}
              <ScrollToTopButton />
            </main>
          </SidebarProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
