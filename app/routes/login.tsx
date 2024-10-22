// app/routes/login.tsx

import { ActionFunction, redirect } from "@remix-run/node";
import { getSession, commitSession } from "~/sessions";

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const remember = formData.get("remember") === "on";

  // Temporary hardcoded credentials for testing
  const validUsername = "admin";
  const validPassword = "password123";

  if (username === validUsername && password === validPassword) {
    // Create a session and store the user data
    const session = await getSession(request.headers.get("Cookie"));
    session.set("user", { username });

    // Set cookie options based on "Remember me"
    let cookieOptions = {};
    if (remember) {
      // Set the session cookie to expire in 7 days
      cookieOptions = {
        maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      };
    }

    // Redirect to the admin page with the session cookie
    return redirect("/admin", {
      headers: {
        "Set-Cookie": await commitSession(session, cookieOptions),
      },
    });
  } else {
    // Authentication failed
    return new Response("Invalid credentials", { status: 401 });
  }
};
