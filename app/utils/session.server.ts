// utils/session.server.ts

import bcrypt from 'bcryptjs'
import type { RowDataPacket } from 'mysql2'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/db.server'
import { getSession } from '~/sessions.server'
import { Positions } from '~/types'

interface LoginUser {
  id: number
  password: string
  email: string
}

export interface User {
  id: number
  email: string
  name: string
  phone_number: string
  is_employee: boolean
  is_admin: boolean
  is_superuser: boolean
  company_id: number
}

export interface SessionUser {
  id: number
  email: string
  name: string
  phone_number: string
  is_employee: boolean
  is_admin: boolean
  is_superuser: boolean
  company_id: number
}

export interface SessionUserNew extends Omit<SessionUser, 'company_id'> {
  company_ids: number[]
}

function getExpirationDate(expiration: number): string {
  const now = new Date()
  const expirationDate = new Date(now.getTime() + expiration * 1000)
  return expirationDate.toISOString().slice(0, 19).replace('T', ' ')
}

export async function register(
  email: string,
  password: string,
  company_id: number,
  isEmployee: number = 1,
  isAdmin: number = 0,
) {
  const passwordHash = await bcrypt.hash(password, 10)
  await db.execute(
    `INSERT INTO users (email, password, company_id, isEmployee, isAdmin) VALUES (?, ?, ?, ?, ?)`,
    [email, passwordHash, company_id, isEmployee, isAdmin],
  )
  return true
}

export async function login(
  email: string,
  password: string,
  expiration: number,
): Promise<string | undefined> {
  const [rows] = await db.query<LoginUser[] & RowDataPacket[]>(
    'SELECT id, password, email FROM users WHERE email = ? AND is_deleted = 0',
    [email],
  )
  if (rows.length < 1) {
    return undefined
  }
  const user = rows[0]
  if (!(await bcrypt.compare(password, user.password))) {
    return undefined
  }
  const id = uuidv4()
  await db.execute(
    `INSERT INTO sessions (id, user_id, expiration_date) VALUES (?, ?, ?)`,
    [id, user.id, getExpirationDate(expiration)],
  )

  return id
}

async function getUser(sessionId: string): Promise<SessionUser | undefined> {
  const [rows] = await db.query<SessionUser[] & RowDataPacket[]>(
    `SELECT users.id, users.email, users.name, users.phone_number, users.is_employee, users.is_admin, users.is_superuser, users.company_id, users.is_deleted FROM users
     JOIN sessions ON sessions.user_id = users.id
     WHERE sessions.id = ?
       AND sessions.expiration_date > CURRENT_TIMESTAMP
       AND sessions.is_deleted = 0
       AND users.is_deleted = 0`,

    [sessionId],
  )
  if (rows.length < 1) {
    return undefined
  }
  return rows[0]
}

async function getUserByPositions(
  sessionId: string,
  companyId: number,
  positions: number[],
): Promise<SessionUserNew | undefined> {
  const [rows] = await db.query<SessionUserNew[] & RowDataPacket[]>(
    `SELECT users.id, users.email, users.name, users.phone_number, users.is_employee, users.is_admin, users.is_superuser, users.company_id, users.is_deleted FROM users
     JOIN users_positions ON users_positions.user_id = users.id
     JOIN sessions ON sessions.user_id = users.id
     WHERE sessions.id = ?
       AND sessions.expiration_date > CURRENT_TIMESTAMP
       AND sessions.is_deleted = 0
       AND users.is_deleted = 0
       AND users_positions.position_id IN (?)
       AND users_positions.company_id = ?`,

    [sessionId, positions, companyId],
  )
  if (rows.length < 1) {
    return undefined
  }
  return rows[0]
}

async function handlePermissions(
  request: Request,
  validUser: (value: SessionUser) => boolean,
): Promise<SessionUser> {
  const cookie = request.headers.get('Cookie')
  const session = await getSession(cookie)
  const sessionId = session.get('sessionId')
  if (sessionId === undefined) {
    throw new TypeError('Session ID cannot be undefined')
  }
  const user = await getUser(sessionId)
  if (user === undefined) {
    throw new TypeError('Could not find session')
  }
  if (!validUser(user)) {
    throw new TypeError('Invalid user permissions')
  }
  return user
}

async function handlePermissionsNew(
  request: Request,
  companyId: number,
  positions: number[],
): Promise<SessionUserNew> {
  const cookie = request.headers.get('Cookie')
  const session = await getSession(cookie)
  const sessionId = session.get('sessionId')
  if (sessionId === undefined) {
    throw new TypeError('Session ID cannot be undefined')
  }
  const user = await getUserByPositions(sessionId, companyId, positions)
  if (user === undefined) {
    throw new TypeError('Could not find session')
  }

  return user
}

export async function getAdminUser(request: Request): Promise<SessionUser> {
  return await handlePermissions(request, user => user.is_admin || user.is_superuser)
}

export async function getEmployeeUser(request: Request): Promise<SessionUser> {
  return await handlePermissions(
    request,
    user => user.is_employee || user.is_admin || user.is_superuser,
  )
}

export async function getMarketingUser(
  request: Request,
  companyId: number,
): Promise<SessionUserNew> {
  return await handlePermissionsNew(request, companyId, [7])
}

export async function getShopWorkerUser(request: Request): Promise<SessionUser> {
  const cookie = request.headers.get('Cookie')
  const session = await getSession(cookie)
  const sessionId = session.get('sessionId')
  if (sessionId === undefined) {
    throw new TypeError('Session ID cannot be undefined')
  }
  const user = await getUser(sessionId)
  if (user === undefined) {
    throw new TypeError('Could not find session')
  }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT position_id FROM users_positions WHERE user_id = ? AND position_id = ? AND company_id = ?`,
    [user.id, Positions.ShopWorker, user.company_id],
  )
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new TypeError('Invalid user permissions')
  }
  return user
}

export async function getSuperUser(request: Request): Promise<SessionUser> {
  return await handlePermissions(request, user => user.is_superuser)
}

export async function getUserBySessionId(
  sessionId: string,
): Promise<SessionUser | undefined> {
  return await getUser(sessionId)
}
