import {
  json,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
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
import { getEmployeeUser, getUserBySessionId } from "./utils/session.server";
import { selectMany } from "./utils/queryHelpers";
import { db } from "~/db.server";
import { Todo, InstructionSlim } from "~/types";
export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const [token, cookieHeader] = await csrf.commitToken();
  const session = await getSession(request.headers.get("Cookie"));
  const activeSession = session.data.sessionId || null;
  const message: ToastMessage | null = session.get("message") || null;

  // try {
  //   await getEmployeeUser(request);
  // } catch (error) {
  //   return redirect(`/login?error=${error}`);
  // }
  // const todos = await selectMany<Todo>(
  //   db,
  //   "SELECT id, name, is_done from todolist"
  // )
  const instructions = await selectMany<InstructionSlim>(
    db,
    "SELECT id, title, rich_text from instructions"
  );

  let user = null;
  if (activeSession) {
    user = await getUserBySessionId(activeSession);
  }

  return json(
    { message, activeSession, token, user, instructions /* todos */ },

    {
      headers: [
        ["Set-Cookie", cookieHeader || ""],
        ["Set-Cookie", await commitSession(session)],
      ],
    }
  );
}

export default function App() {
  const { message, activeSession, token, user, instructions /* todos*/ } =
    useLoaderData<typeof loader>();
  const { toast } = useToast();

  useEffect(() => {
    if (message !== null && message !== undefined) {
      toast({
        title: message.title,
        description: message.description,
        variant: message.variant,
      });
    }
  }, [message ? message.nonce : null]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {activeSession && (
          <Header
            // todos={todos}
            activeSession={activeSession}
            isAdmin={user ? user.is_admin : false}
            isSuperUser={user ? user.is_superuser : false}
            isEmployee={
              user
                ? user.is_employee || user.is_admin || user.is_superuser
                : false
            }
          />
        )}
        <AuthenticityTokenProvider token={token}>
          <Outlet />
        </AuthenticityTokenProvider>
        <Toaster />
        <ScrollRestoration />
        {/* <Footer /> */}
        <Scripts />
      </body>

      <Chat instructions={instructions} />
    </html>
  );
}
