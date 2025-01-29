// app/root.tsx (for example)
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
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { Header } from "./components/Header";
import { Toaster } from "./components/ui/toaster";
import "./tailwind.css";
import { commitSession, getSession } from "./sessions";
import { useToast } from "./hooks/use-toast";
import { useEffect } from "react";
import { toastData, ToastMessage } from "./utils/toastHelpers";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenProvider } from "remix-utils/csrf/react";
import { Chat } from "./components/organisms/Chat";
import { getAdminUser, getEmployeeUser } from "./utils/session.server";
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
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const [token, cookieHeader] = await csrf.commitToken();
  const session = await getSession(request.headers.get("Cookie"));
  const activeSession = session.data.sessionId || null;
  const message: ToastMessage | null = session.get("message") || null;

  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  const todos = await selectMany<Todo>(
    db,
    "SELECT id, rich_text, is_done FROM todolist WHERE user_id = ?",
    [user.id]
  );
  console.log(user);
  let instructions: InstructionSlim[] = [];
  if (user && activeSession) {
    instructions = await selectMany<InstructionSlim>(
      db,
      "SELECT id, title, rich_text FROM instructions WHERE company_id = ?",
      [user.company_id]
    );
  }

  return json(
    { message, token, user, instructions, todos },
    {
      headers: [
        ["Set-Cookie", cookieHeader || ""],
        ["Set-Cookie", await commitSession(session)],
      ],
    }
  );
}

export default function App() {
  const { message, token, user, instructions, todos } =
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
  }, [message?.nonce]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body>
        {user && (
          <Header
            todos={todos}
            user={user}
            isAdmin={user.is_admin}
            isSuperUser={user.is_superuser}
            isEmployee={user.is_employee || user.is_admin || user.is_superuser}
          />
        )}

        <AuthenticityTokenProvider token={token}>
          <Outlet />
        </AuthenticityTokenProvider>

        <Toaster />
        <ScrollRestoration />
        <Scripts />

        {user && <Chat instructions={instructions} />}
      </body>
    </html>
  );
}
