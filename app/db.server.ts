import mysql, { type PoolOptions } from 'mysql2/promise'

const access: PoolOptions = {
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  timezone: 'Z',
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
}

export const db = mysql.createPool(access)
