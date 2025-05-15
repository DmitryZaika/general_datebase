import OAuthClient from "intuit-oauth";
import { db  } from "./db.server";
import { TokenSet } from "~/types";



async function loadTokens(): Promise<TokenSet> {
  const [rows] = await db.query<any[]>(
    "SELECT access_token, refresh_token, expires_at FROM qbo_tokens WHERE id = 1 LIMIT 1"
  );
  if (rows.length === 0) {
    return { access_token: undefined, refresh_token: undefined, expires_at: undefined };
  }
  return {
    access_token: rows[0].access_token ?? null,
    refresh_token: rows[0].refresh_token ?? null,
    expires_at: rows[0].expires_at ? Number(rows[0].expires_at) : undefined,
  };
}


let oauthClient: OAuthClient | null = null;

let tokenCache: TokenSet | null = null;        // загружается лениво
let refreshInFlight: Promise<string> | null = null;

async function getTokenCache(): Promise<TokenSet> {
  if (!tokenCache) {
    const result = await loadTokens();
    if (result.refresh_token === undefined) {
      console.log(process.env.QBO_REDIRECT_URI);
      const requestUrl = getQboClient().authorizeUri({ scope: "com.intuit.quickbooks.accounting" });
      console.log(requestUrl)
      const result = await fetch(requestUrl, { method: "GET" })
      console.log(result.status)
      return Promise.reject()
    }
    tokenCache = result;
  }
  return tokenCache;
}


function getQboClient(): OAuthClient {
  if (!oauthClient) {
    oauthClient = new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID!,
      clientSecret: process.env.QBO_CLIENT_SECRET!,
      environment: process.env.QBO_ENV ?? "sandbox",
      redirectUri: process.env.QBO_REDIRECT_URI!,
      logging: true,
    });
  }
  return oauthClient;
}

export async function ensureAccessToken(): Promise<string> {
  let cache
  try {
    cache = await getTokenCache();
  } catch(e) {
    return Promise.reject("Error loading tokens");
  }
  const now = Date.now();

  if (cache.access_token && cache.expires_at && now < cache.expires_at - 60_000) {
    return cache.access_token; // ещё свежий
  }

  // чтобы параллельные вызовы не делали несколько refresh
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    if (!cache.refresh_token) {
      throw new Error("Нет refresh_token ‑ пройдите OAuth авторизацию QuickBooks.");
    }

    const client = getQboClient();
    client.setToken({
      access_token: cache.access_token ?? "",
      refresh_token: cache.refresh_token,
      token_type: "bearer",
      expires_in: 0,
      x_refresh_token_expires_in: 0,
    });

    const authResponse = await client.refresh();
    const js = authResponse.getJson();

    cache.access_token = js.access_token;
    cache.refresh_token = js.refresh_token; // Intuit всегда отдаёт новый
    cache.expires_at = Date.now() + js.expires_in * 1000;

    await saveTokens(cache);                // сразу сохранили
    client.setToken(js);                    // держим в клиенте актуально

    refreshInFlight = null;
    return js.access_token;
  })();

  return refreshInFlight;
}

export const REALM_ID: string = process.env.QBO_REALM_ID!;

export async function queryQboCustomers(whereClause?: string, select = "*") {
  const accessToken = await ensureAccessToken();
  const where = whereClause ? ` WHERE ${whereClause}` : "";
  const q = encodeURIComponent(`select ${select} from Customer${where}`);
  const url = `https://quickbooks.api.intuit.com/v3/company/${REALM_ID}/query?query=${q}&minorversion=70`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`QBO customer query failed: ${await res.text()}`);
  }
  const js = await res.json();
  return js.QueryResponse?.Customer ?? [];
}
