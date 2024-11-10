import { db } from "~/db.server";
import { RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getSession, commitSession } from "~/sessions";

interface LoginUser {
  id: number;
  password: string;
}

interface SessionUser {
  email: string;
  name: string;
}

import { redirect } from "@remix-run/node";

export async function createUserSession(sessionId: string) {
  const session = await getSession();
  session.set("sessionId", sessionId);
  return redirect("/home", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

function getExpirationDate(expiration: number): string {
  const now = new Date();
  const expirationDate = new Date(now.getTime() + expiration * 1000);
  return expirationDate.toISOString().slice(0, 19).replace("T", " ");
}

export async function register(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.execute(
    `INSERT INTO main.users  (email, password) VALUES ( ?, ?)`,
    [email, passwordHash]
  );
  return true;
}

export async function login(
  email: string,
  password: string,
  expiration: number
): Promise<string | undefined> {
  const [rows] = await db.query<LoginUser[] & RowDataPacket[]>(
    "SELECT id, password FROM users WHERE email = ?",
    [email]
  );
  if (rows.length < 1) {
    return undefined;
  }
  const user = rows[0];
  if (!bcrypt.compare(password, user.password)) {
    return undefined;
  }
  const id = uuidv4();
  const result = await db.execute(
    `INSERT INTO main.sessions  (id, user_id, expiration_date) VALUES ( ?, ?, ?)`,
    [id, user.id, getExpirationDate(expiration)]
  );

  return id;
}

export async function getAdmin(
  sessionId: string
): Promise<undefined | SessionUser> {
  const [rows] = await db.query<SessionUser[] & RowDataPacket[]>(
    `SELECT users.email, users.name FROM users
        JOIN sessions ON sessions.user_id == user.id
        WHERE sessions.id = ?  
            AND sessions.expiration_date > CURRENT_TIMESTAMP
            AND (users.is_admin OR users.is_superuser)`,
    [sessionId]
  );
  if (rows.length < 1) {
    return undefined;
  }
  return rows[0];
}