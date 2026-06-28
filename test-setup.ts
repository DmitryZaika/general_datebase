import dotenv from 'dotenv'

// Load .env before importing any module whose top level reads process.env
// (e.g. tests/testDatabase.ts's TEST_DB_CONFIG).
dotenv.config()

import mysql from 'mysql2/promise'
import { afterEach, beforeEach, vi } from 'vitest'
import { TEST_DB_CONFIG } from './tests/testDatabase'

if (!process.env.DB_DATABASE?.includes('test')) {
  // biome-ignore lint/suspicious/noConsole: for tests
  console.warn('Warning: Database name should contain "test" for safety')
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

// Pool so each query gets a fresh connection — mysql2's per-connection
// prepared-statement cache otherwise goes stale across helper.setup()'s
// DROP/CREATE cycles.
vi.mock('~/db.server', () => {
  const pool = mysql.createPool({
    ...TEST_DB_CONFIG,
    connectionLimit: 5,
    waitForConnections: true,
  })
  return {
    db: {
      execute: async (sql: string, params: unknown[]) => {
        return await pool.execute(sql, params)
      },
      query: async (sql: string, params: unknown[]) => {
        return await pool.query(sql, params)
      },
    },
  }
})

// biome-ignore lint/suspicious/noConsole: for tests
const originalLog = console.log
beforeEach(() => {
  console.log = vi.fn()
})

afterEach(() => {
  console.log = originalLog
})
