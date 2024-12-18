import { db } from "~/db.server";
import { RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "~/sessions";

interface LoginUser {
  id: number;
  password: string;
}

interface SessionUser {
  email: string;
  name: string;
  is_employee: boolean;
  is_admin: boolean;
  is_superuser: boolean;
}

function getExpirationDate(expiration: number): string {
  const now = new Date();
  const expirationDate = new Date(now.getTime() + expiration * 1000);
  return expirationDate.toISOString().slice(0, 19).replace("T", " ");
}

export async function register(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  await db.execute(
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

async function getUser(sessionId: string): Promise<undefined | SessionUser> {
  const [rows] = await db.query<SessionUser[] & RowDataPacket[]>(
    `SELECT users.email, users.name, users.is_employee, users.is_admin, users.is_superuser FROM users
        JOIN sessions ON sessions.user_id = users.id
        WHERE sessions.id = ?
            AND sessions.expiration_date > CURRENT_TIMESTAMP
            AND sessions.is_deleted = 0`,

    [sessionId]
  );
  if (rows.length < 1) {
    return undefined;
  }
  return rows[0];
}

async function handlePermissions(
  request: Request,
  validUser: (value: SessionUser) => boolean
): Promise<SessionUser> {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);
  const cookieHeader = session.get("sessionId");
  if (cookieHeader === undefined) {
    throw TypeError("Cookie Header cannot be undefined");
  }
  const user = await getUser(cookieHeader);
  if (user === undefined) {
    throw TypeError("Could not find session");
  }
  if (!validUser(user)) {
    throw TypeError("Invalid user permisions");
  }
  return user;
}

export async function getAdminUser(request: Request): Promise<SessionUser> {
  return await handlePermissions(
    request,
    (user) => user.is_admin || user.is_superuser
  );
}

export async function getEmployeeUser(request: Request): Promise<SessionUser> {
  return await handlePermissions(
    request,
    (user) => user.is_admin || user.is_superuser || user.is_employee
  );
}

export async function getSuperUser(request: Request): Promise<SessionUser> {
  return await handlePermissions(request, (user) => user.is_superuser);
}
