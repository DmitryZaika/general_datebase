import OAuthClient from 'intuit-oauth'
import type { RowDataPacket } from 'mysql2'
import type { RemixSession } from '~/sessions'
import type { TokenSet } from '~/types'
import { decrypt, encrypt } from '~/utils/cryptoHelpers.server'
import { db } from '../db.server'

interface QboCompanyInfo {
  qbo_client_id: string
  qbo_client_secret: string
}

export async function saveCompanyQBO(
  companyId: number,
  clientId: string,
  clientSecret: string,
) {
  const encClientId = encrypt(clientId)
  const encClientSecret = encrypt(clientSecret)

  await db.execute(
    `UPDATE company
       SET qbo_client_id     = ?,
           qbo_client_secret = ?,
     WHERE id = ?`,
    [encClientId, encClientSecret, companyId],
  )
}

export async function loadCompanyQBO(companyId: number) {
  const [rows] = await db.query<QboCompanyInfo[] & RowDataPacket[]>(
    `SELECT qbo_client_id, qbo_client_secret
       FROM company
      WHERE id = ?`,
    [companyId],
  )

  if (!rows.length) throw new Error('Компания не найдена')

  return {
    clientId: decrypt(rows[0].qbo_client_id),
    clientSecret: decrypt(rows[0].qbo_client_secret),
  }
}

function getHost(request: Request): string {
  // если стоим за прокси/Cloudflare/Heroku — сначала смотрим forwarded‑заголовки
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) return forwardedHost.split(',')[0].trim()

  // обычный прямой запрос
  const host = request.headers.get('host')
  if (host) return host

  // fallback (теоретически до него не доходим)
  return new URL(request.url).host
}

async function getOauthClient(request: Request, companyId: number) {
  const { clientId, clientSecret } = await loadCompanyQBO(companyId)
  const host = getHost(request)
  const proto =
    request.headers.get('x-forwarded-proto') ??
    new URL(request.url).protocol.replace(':', '')
  const redirect = `${proto}://${host}/redirects/quickbooks/user-auth`
  return new OAuthClient({
    clientId,
    clientSecret,
    environment: process.env.QBO_ENV ?? 'sandbox',
    redirectUri: redirect,
    logging: true,
  })
}

export async function getQboUrl(request: Request, companyId: number): OAuthClient {
  return (await getOauthClient(request, companyId)).authorizeUri({
    scope: 'com.intuit.quickbooks.accounting',
  })
}

export async function getQboToken(
  request: Request,
  companyId: number,
): Promise<TokenSet> {
  const oauthClient = await getOauthClient(request, companyId)
  const raw = await oauthClient.createToken(request.url)
  return raw.getJson()
}

export async function refreshQboToken(
  request: Request,
  companyId: number,
  refreshToken: string,
): Promise<TokenSet> {
  const oauthClient = await getOauthClient(request, companyId)
  const raw = await oauthClient.refreshUsingToken(refreshToken)
  return raw.getJson()
}

export function setQboSession(session: RemixSession, qboToken: TokenSet) {
  const now = Math.floor(Date.now() / 1000)
  session.set('sessionId', session.get('sessionId') ?? crypto.randomUUID())
  session.set('qboAccessToken', qboToken.access_token)
  session.set('qboRefreshToken', qboToken.refresh_token)
  session.set('qboAccessExpires', qboToken.expires_in + now)
  session.set('qboRefreshExpires', qboToken.x_refresh_token_expires_in + now)
}

export function clearQboSession(session: RemixSession): RemixSession {
  const keys = [
    'qboAccessToken',
    'qboRefreshToken',
    'qboAccessExpires',
    'qboRefreshExpires',
  ] as const

  keys.forEach(key => session.unset(key))

  return session
}

export enum QboTokenState {
  ACCESS_VALID = 'ACCESS_VALID', // access‑токен ещё жив
  REFRESH_VALID = 'REFRESH_VALID', // access умер, но refresh ещё жив
  INVALID = 'INVALID', // оба истекли или отсутствуют
}

export function getQboTokenState(
  session: RemixSession,
  safetyGap = 60, // секундный буфер
): QboTokenState {
  const now = Math.floor(Date.now() / 1000)

  const accessToken = session.get('qboAccessToken') as string | undefined
  const accessExpiresAt = session.get('qboAccessExpires') as number | undefined
  const refreshToken = session.get('qboRefreshToken') as string | undefined
  const refreshExpiresAt = session.get('qboRefreshExpires') as number | undefined

  const accessValid =
    !!accessToken && !!accessExpiresAt && now < accessExpiresAt - safetyGap
  if (accessValid) return QboTokenState.ACCESS_VALID

  const refreshValid =
    !!refreshToken && !!refreshExpiresAt && now < refreshExpiresAt - safetyGap
  if (refreshValid) return QboTokenState.REFRESH_VALID

  return QboTokenState.INVALID
}

export async function createQboCustomer(
  accessToken: string,
  realmId: string,
  name: string,
  email: string,
  phone: string,
  address: Partial<{
    Line1: string
    Line2: string
    City: string
    CountrySubDivisionCode: string
    PostalCode: string
    Country: string
  }>,
) {
  if (!name) {
    throw new Error('Нужно указать имя клиента')
  }

  const body: Record<string, unknown> = { DisplayName: name }

  body.PrimaryEmailAddr = { Address: email }
  body.PrimaryPhone = { FreeFormNumber: phone }
  if (Object.keys(address).length) {
    body.BillAddr = address
  }

  const prefix = process.env.QBO_ENV === 'production' ? '' : 'sandbox-'
  const url = `https://${prefix}quickbooks.api.intuit.com/v3/company/${realmId}/customer?minorversion=75`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`QBO customer create failed: ${await res.text()}`)
  }

  const js = await res.json()
  return js.Customer
}

export async function queryQboCustomersByContact(
  accessToken: string,
  realmId: string,
  email?: string,
) {
  if (!email) {
    throw new Error('Нужно указать хотя бы email или phone')
  }

  // экранируем одиночные кавычки
  const esc = (v: string) => v.replace(/'/g, "''")

  const query = `select * from Customer WHERE PrimaryEmailAddr = '${esc(email)}'`
  const q = encodeURIComponent(query)
  const prefix = process.env.QBO_ENV === 'production' ? '' : 'sandbox-'
  const url = `https://${prefix}quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${q}&minorversion=75`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`QBO customer query failed: ${await res.text()}`)
  }

  const js = await res.json()
  return js.QueryResponse.Customer || []
}

export async function getQboCompanyInformation(
  accessToken: string,
  realmId: string,
): Promise<object | number> {
  const prefix = process.env.QBO_ENV === 'production' ? '' : 'sandbox-'
  const url = `https://${prefix}quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=75`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    return res.status
  }
  return await res.json()
}
