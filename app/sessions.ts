import { createCookieSessionStorage } from "@remix-run/node";
import { ToastMessage } from "./utils/toastHelpers";

type SessionData = {
  sessionId: string;
};

type SessionFlashData = {
  message: ToastMessage;
};

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
      secrets: [process.env.SESSION_SECRET || ""],
      secure: process.env.NODE_ENV === "production",
    },
  });
export { getSession, commitSession, destroySession };
