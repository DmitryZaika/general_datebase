import { createCookieSessionStorage } from "react-router";
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
      secure: false,
    },
  });
export { getSession, commitSession, destroySession };
