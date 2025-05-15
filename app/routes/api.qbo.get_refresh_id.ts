import { LoaderFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { TokenSet } from "~/types";


export async function saveTokens(t: TokenSet): Promise<void> {
  await db.query(
    `INSERT INTO qbo_tokens (id, access_token, refresh_token, expires_at)
     VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       access_token = VALUES(access_token),
       refresh_token = VALUES(refresh_token),
       expires_at   = VALUES(expires_at)`,
    [t.access_token, t.refresh_token, t.expires_at]
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  const data = await request.text();
  console.log(data)
  console.log("HERE")
  return new Response("ok", { status: 200 });
} 
