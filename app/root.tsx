import { SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { useIsMobile } from "~/hooks/use-mobile";
import { data, useLocation } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { Header } from "./components/Header";
import { Toaster } from "./components/ui/toaster";
import "./tailwind.css";
import { commitSession, getSession } from "./sessions";
import { useToast } from "./hooks/use-toast";
import { useEffect } from "react";
import { ToastMessage } from "./utils/toastHelpers";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenProvider } from "remix-utils/csrf/react";
import { Chat } from "./components/organisms/Chat";
import { getUserBySessionId } from "./utils/session.server";
import { selectMany } from "./utils/queryHelpers";
import { db } from "~/db.server";
import { EmployeeSidebar } from "~/components/molecules/Sidebars/EmployeeSidebar";
import { getBase } from "~/utils/urlHelpers";
import { ISupplier } from "~/schemas/suppliers";
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { posthog } from 'posthog-js'

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
  },
];

export function Posthog() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("posthog-js")
        .then(({ default: posthog }) => {
          if (!posthog.__loaded) {
            posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
              api_host: "https://us.i.posthog.com",
              person_profiles: "always",
            });
          }
        })
        .catch(console.error);
    }
  }, []);

  return null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const [token, cookieHeader] = await csrf.commitToken();
  const session = await getSession(request.headers.get("Cookie"));
  const activeSession = session.data.sessionId || null;
  const message: ToastMessage | null = session.get("message") || null;

  let user = null;
  if (activeSession) {
    user = (await getUserBySessionId(activeSession)) || null;
  }

  let stoneSuppliers: ISupplier[] | undefined = undefined;
  let sinkSuppliers: ISupplier[] | undefined = undefined;
  
  if (user) {
    stoneSuppliers = await selectMany<ISupplier>(
      db,
      `SELECT s.id, s.supplier_name 
       FROM suppliers s
       INNER JOIN stones st ON s.id = st.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name`,
      [user.company_id]
    );
    
    sinkSuppliers = await selectMany<ISupplier>(
      db,
      `SELECT s.id, s.supplier_name 
       FROM suppliers s
       INNER JOIN sinks sk ON s.id = sk.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name`,
      [user.company_id]
    );
  }

  return data(
    { message, token, user, stoneSuppliers, sinkSuppliers },

    {
      headers: [
        ["Set-Cookie", cookieHeader || ""],
        ["Set-Cookie", await commitSession(session)],
      ],
    }
  );
}

const queryClient = new QueryClient();

export default function App() {
  const { message, token, user, stoneSuppliers, sinkSuppliers } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (message !== null && message !== undefined) {
      toast({
        title: message.title,
        description: message.description,
        variant: message.variant,
      });
      if (message.description === "Logged in" && user) {
        if (typeof window !== "undefined") {
          posthog.identify(user.email);
        }
      }
    }
  }, [message?.nonce]);

  const basePath = getBase(pathname);

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider open={!!basePath}>
          <EmployeeSidebar suppliers={stoneSuppliers} sinkSuppliers={sinkSuppliers} />
          <main className="h-screen overflow-y-auto bg-gray-100 w-full">
            <AuthenticityTokenProvider token={token}>
              <Header
                isEmployee={user?.is_employee ?? false}
                user={user}
                isAdmin={user?.is_admin ?? false}
                isSuperUser={user?.is_superuser ?? false}
              />
              <div className="relative">
                {isMobile && <SidebarTrigger />}
                <Outlet />
              </div>
            </AuthenticityTokenProvider>
            <Toaster />
            <ScrollRestoration />
            <Scripts />
            <Posthog />

            {user && <Chat />}
          </main>
        </SidebarProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
