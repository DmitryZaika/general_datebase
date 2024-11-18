import { v4 as uuidv4 } from "uuid";
import { commitSession, getSession } from "~/sessions";
import { redirect } from "@remix-run/node";

type Variants = "default" | "destructive" | "success";

export interface ToastMessage {
  nonce: string;
  variant: Variants;
  description: string;
  title: string;
}

export function toastData(
  title: string,
  description: string,
  variant: Variants = "success"
): ToastMessage {
  return {
    nonce: uuidv4(),
    variant,
    description,
    title,
  };
}

export async function forceRedirectError(
  headers: Headers,
  description: string
) {
  const session = await getSession(headers.get("Cookie"));
  session.flash("message", toastData("Error", description, "destructive"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
