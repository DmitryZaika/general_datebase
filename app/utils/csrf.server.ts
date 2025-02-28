import { CSRF } from "remix-utils/csrf/server";
import { createCookie } from "react-router";

export const cookie = createCookie("csrf", {
  path: "/",
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  secrets: [process.env.SESSION_SECRET || ""],
});

export const csrf = new CSRF({
  cookie,
  formDataKey: "csrf",
  secret: process.env.SESSION_SECRET,
});
