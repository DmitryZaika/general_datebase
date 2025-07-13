import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import { afterEach, beforeEach, vi } from 'vitest'
import { TEST_DB_CONFIG } from './tests/testDatabase'

// Load environment variables
dotenv.config()

// Ensure we're using a test database
if (!process.env.DB_DATABASE?.includes('test')) {
  console.warn('Warning: Database name should contain "test" for safety')
}

// Set test environment variables if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

vi.mock('~/db.server', () => {
  let testConnection: mysql.Connection | null = null

  const getTestConnection = async () => {
    if (!testConnection) {
      testConnection = await mysql.createConnection(TEST_DB_CONFIG)
    }
    return testConnection
  }

  return {
    db: {
      execute: async (sql: string, params: unknown[]) => {
        const connection = await getTestConnection()
        return await connection.execute(sql, params)
      },
    },
  }
})

// Mock console.log for cleaner test output
const originalLog = console.log
beforeEach(() => {
  console.log = vi.fn()
})

afterEach(() => {
  console.log = originalLog
})
