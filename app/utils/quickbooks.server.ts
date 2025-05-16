import OAuthClient from "intuit-oauth";
import { db } from "../db.server";
import { RowDataPacket } from "mysql2";
import { TokenSet } from "~/types";
import { encrypt, decrypt } from "~/utils/cryptoHelpers.server";

interface QboCompanyInfo {
    qbo_client_id: string;
    qbo_client_secret: string;
    qbo_realm_id: string;
}

export async function saveCompanyQBO(
  companyId: number,
  clientId: string,
  clientSecret: string,
  realmId: number,
) {
  const encClientId     = encrypt(clientId);
  const encClientSecret = encrypt(clientSecret);
  const encRealmId      = encrypt(realmId.toString());

  await db.execute(
    `UPDATE company
       SET qbo_client_id     = ?,
           qbo_client_secret = ?,
           qbo_realm_id      = ?
     WHERE id = ?`,
    [encClientId, encClientSecret, encRealmId, companyId],
  );
}

export async function loadCompanyQBO(companyId: number) {
  const [rows] = await db.query<QboCompanyInfo[] & RowDataPacket[]>(
    `SELECT qbo_client_id, qbo_client_secret, qbo_realm_id
       FROM company
      WHERE id = ?`,
    [companyId],
  );

  if (!rows.length) throw new Error('Компания не найдена');

  return {
    clientId:     decrypt(rows[0].qbo_client_id),
    clientSecret: decrypt(rows[0].qbo_client_secret),
    realmId:      parseInt(decrypt(rows[0].qbo_realm_id)),
  };
}


export async function getQboUrl(companyId: number): OAuthClient {
  const { clientId, clientSecret, realmId } = await loadCompanyQBO(companyId);
  return new OAuthClient({
    clientId,
    clientSecret,
    environment: process.env.QBO_ENV ?? "sandbox",
    redirectUri: process.env.QBO_REDIRECT_URI!,
    logging: true,
  }).authorizeUri({ scope: "com.intuit.quickbooks.accounting" })
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
