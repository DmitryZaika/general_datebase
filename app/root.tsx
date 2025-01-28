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
import { z } from "zod";
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
import {
  getAdminUser,
  getEmployeeUser,
  getUserBySessionId,
} from "./utils/session.server";
import { selectMany } from "./utils/queryHelpers";
import { db } from "~/db.server";
import { Todo, InstructionSlim } from "~/types";
import { getValidatedFormData } from "remix-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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

const todolistschema = z.object({
  rich_text: z.string(),
});

type FormData = z.infer<typeof todolistschema>;

const resolver = zodResolver(todolistschema);

export async function action({ request }: ActionFunctionArgs) {
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver
  );

  if (errors) {
    return { errors, receivedValues };
  }

  let user = getAdminUser(request);

  try {
    await db.execute(
      `INSERT INTO main.todolist (rich_text, user_id) VALUES (?, ?)`,
      [data.rich_text, (await user).id]
    );
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "New todo added"));

  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

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

  let instructions: InstructionSlim[] = [];

  let user = null;
  if (activeSession) {
    user = (await getUserBySessionId(activeSession)) || null;
    if (user) {
      instructions = await selectMany<InstructionSlim>(
        db,
        "SELECT id, title, rich_text from instructions WHERE company_id = ?",
        [user.company_id]
      );
    }
  }

  // const userId = await getEmployeeUser(request);
  // const todos = await selectMany<Todo>(
  //   db,
  //   "SELECT id, rich_text, is_done from todolist WHERE user_id = ?",
  //   [userId.id]
  // );
  const instructions = await selectMany<InstructionSlim>(
    db,
    "SELECT id, title, rich_text from instructions"
  );

  return json(
    { message, token, user, instructions /* todos */ },

    {
      headers: [
        ["Set-Cookie", cookieHeader || ""],
        ["Set-Cookie", await commitSession(session)],
      ],
    }
  );
}

export default function App() {
  const { message, token, user, instructions /* todos*/ } =
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
        {user && (
          <Header
            // todos={todos}
            user={user}
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

      {user && <Chat instructions={instructions} />}
    </html>
  );
}
