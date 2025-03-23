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

interface ISupplier {
  id: number;
  supplier_name: string;
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

  let suppliers: ISupplier[] = [];
  if (user) {
    suppliers = await selectMany<ISupplier>(
      db,
      "select id, supplier_name from suppliers where company_id = ?",
      [user.company_id],
    );
  }

  return data(
    { message, token, user },

    {
      headers: [
        ["Set-Cookie", cookieHeader || ""],
        ["Set-Cookie", await commitSession(session)],
      ],
    },
  );
}

export default function App() {
  const { message, token, user } = useLoaderData<typeof loader>();
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
        <SidebarProvider open={!!basePath}>
          <EmployeeSidebar />
          <main className="h-screen bg-gray-100 w-full">
            <AuthenticityTokenProvider token={token}>
              <Header
                isEmployee={user?.is_employee ?? false}
                user={user}
                isAdmin={user?.is_admin ?? false}
                isSuperUser={user?.is_superuser ?? false}
              />
              {isMobile && <SidebarTrigger />}
              <Outlet />
            </AuthenticityTokenProvider>
            <Toaster />
            <ScrollRestoration />
            <Scripts />

            {user && <Chat />}
          </main>
        </SidebarProvider>
      </body>
    </html>
  );
}
