import OAuthClient from "intuit-oauth";
import { db } from "../db.server";
import { RowDataPacket } from "mysql2";
import { TokenSet } from "~/types";
import { encrypt, decrypt } from "~/utils/cryptoHelpers.server";
import { RemixSession } from "~/sessions";

interface QboCompanyInfo {
    qbo_client_id: string;
    qbo_client_secret: string;
}

export async function saveCompanyQBO(
  companyId: number,
  clientId: string,
  clientSecret: string,
) {
  const encClientId     = encrypt(clientId);
  const encClientSecret = encrypt(clientSecret);

  await db.execute(
    `UPDATE company
       SET qbo_client_id     = ?,
           qbo_client_secret = ?,
     WHERE id = ?`,
    [encClientId, encClientSecret, companyId],
  );
}

export async function loadCompanyQBO(companyId: number) {
  const [rows] = await db.query<QboCompanyInfo[] & RowDataPacket[]>(
    `SELECT qbo_client_id, qbo_client_secret
       FROM company
      WHERE id = ?`,
    [companyId],
  );

  if (!rows.length) throw new Error('Компания не найдена');

  return {
    clientId:     decrypt(rows[0].qbo_client_id),
    clientSecret: decrypt(rows[0].qbo_client_secret),
  };
}

function getHost(request: Request): string {
  // если стоим за прокси/Cloudflare/Heroku — сначала смотрим forwarded‑заголовки
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) return forwardedHost.split(',')[0].trim();

  // обычный прямой запрос
  const host = request.headers.get('host');
  if (host) return host;

  // fallback (теоретически до него не доходим)
  return new URL(request.url).host;
}

async function getOauthClient(request: Request, companyId: number) {
  const { clientId, clientSecret } = await loadCompanyQBO(companyId);
  const host      = getHost(request);
  const proto     = request.headers.get('x-forwarded-proto')
                 ?? new URL(request.url).protocol.replace(':', '');
  const redirect  = `${proto}://${host}/redirects/quickbooks/user-auth`;
  return new OAuthClient({
    clientId,
    clientSecret,
    environment: process.env.QBO_ENV ?? "sandbox",
    redirectUri: redirect,
    logging: true,
  })

}

export async function getQboUrl(request: Request, companyId: number): OAuthClient {
  return (await getOauthClient(request, companyId)).authorizeUri({ scope: "com.intuit.quickbooks.accounting" })
}

export async function getQboToken(request: Request, companyId: number): Promise<TokenSet> {
    const oauthClient = await getOauthClient(request, companyId);
    const raw = await oauthClient.createToken(request.url)
    return raw.getJson()
  }

export async function refreshQboToken(request: Request, companyId: number): Promise<TokenSet> {
  const oauthClient = await getOauthClient(request, companyId);
  const raw = await oauthClient.refresh()
  return raw.getJson()
}

export function setQboSession(session: RemixSession, qboToken: TokenSet) {
  const now = Math.floor(Date.now() / 1000);
  session.set('sessionId', session.get('sessionId') ?? crypto.randomUUID());
  session.set('qboAccessToken', qboToken.access_token);
  session.set('qboRefreshToken', qboToken.refresh_token);
  session.set('expires', qboToken.expires_in + now);
  session.set('refreshExpires', qboToken.x_refresh_token_expires_in + now);
}

export async function queryQboCustomers(whereClause?: string, select = "*") {
  const where = whereClause ? ` WHERE ${whereClause}` : "";
  const q = encodeURIComponent(`select ${select} from Customer${where}`);
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${q}&minorversion=70`;

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
