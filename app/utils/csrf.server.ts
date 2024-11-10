import { CSRF } from "remix-utils/csrf/server";
import { createCookie } from "@remix-run/node";

export const cookie = createCookie("csrf", {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  secrets: [process.env.COOKIE_SECRET || ""],
});

export const csrf = new CSRF({
  cookie,
  formDataKey: "csrf",
  secret: process.env.COOKIE_SECRET || "",
});
