import { LoaderFunction, redirect } from "@remix-run/node";
import { db } from "~/db.server";
import { getSession, destroySession } from "~/sessions";

export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  if (!cookie) {
    return redirect("/");
  }
  const session = await getSession(cookie);
  const sessionId = session.get("sessionId");
  if (sessionId) {
    const result = await db.execute(
      `UPDATE main.sessions SET is_deleted = 1 WHERE id = ?`,
      [sessionId]
    );
  }

  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};
