import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import type { TCustomerSchema, TRoomSchema } from '~/schemas/sales'
import type { User } from '~/utils/session.server'
import { testMigrations } from '../scripts/migrate'

dotenv.config()

export const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE ? `${process.env.DB_DATABASE}_test` : 'test_db',
  multipleStatements: true,
}

// biome-ignore lint/complexity/noStaticOnlyClass: mock db
export class DatabaseTestHelper {
  static connection: mysql.Connection | null = null

  static async connect(): Promise<mysql.Connection> {
    if (!DatabaseTestHelper.connection) {
      DatabaseTestHelper.connection = await mysql.createConnection({
        ...TEST_DB_CONFIG,
        multipleStatements: true,
      })
    }
    return DatabaseTestHelper.connection
  }

  static async createTestDatabase(): Promise<void> {
    const connection = await mysql.createConnection({
      host: TEST_DB_CONFIG.host,
      user: TEST_DB_CONFIG.user,
      password: TEST_DB_CONFIG.password,
      multipleStatements: true,
    })

    try {
      await connection.execute(`DROP DATABASE IF EXISTS ${TEST_DB_CONFIG.database}`)
      await connection.execute(`CREATE DATABASE ${TEST_DB_CONFIG.database}`)

      // Wait a moment for database to be ready
      await new Promise(resolve => setTimeout(resolve, 100))
    } finally {
      await connection.end()
    }
  }

  static async runMigrations(): Promise<void> {
    await testMigrations(
      TEST_DB_CONFIG.database,
      TEST_DB_CONFIG.user,
      TEST_DB_CONFIG.password,
      TEST_DB_CONFIG.host,
    )
  }

  static async clearAllTables(): Promise<void> {
    const connection = await DatabaseTestHelper.connect()

    // Get all table names
    const [tables] = await connection.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${TEST_DB_CONFIG.database}'
        AND table_type = 'BASE TABLE'
      `)

    // Disable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0')

    for (const table of tables as mysql.RowDataPacket[]) {
      await connection.execute(`DELETE FROM ${table.TABLE_NAME}`)
    }

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1')
  }

  static async insertTestData(
    table: string,
    data: Record<string, unknown>,
  ): Promise<number> {
    const connection = await DatabaseTestHelper.connect()
    const columns = Object.keys(data).join(', ')
    const placeholders = Object.keys(data)
      .map(() => '?')
      .join(', ')
    const values = Object.values(data)

    const [result] = await connection.execute(
      `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
      values,
    )

    return (result as mysql.ResultSetHeader).insertId
  }

  static async selectFromTable(
    table: string,
    where?: Record<string, unknown>,
  ): Promise<mysql.RowDataPacket[]> {
    const connection = await DatabaseTestHelper.connect()
    let sql = `SELECT * FROM ${table}`
    let params: unknown[] = []

    if (where) {
      const conditions = Object.keys(where)
        .map(key => `${key} = ?`)
        .join(' AND ')
      sql += ` WHERE ${conditions}`
      params = Object.values(where)
    }

    const [rows] = await connection.execute(sql, params)
    return rows as mysql.RowDataPacket[]
  }

  static async disconnect(): Promise<void> {
    if (DatabaseTestHelper.connection) {
      await DatabaseTestHelper.connection.end()
      DatabaseTestHelper.connection = null
    }
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: mock db
export class TestDataFactory {
  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      is_employee: true,
      is_admin: false,
      is_superuser: false,
      company_id: 1,
      ...overrides,
    }
  }

  static createCustomerSchema(
    overrides: Partial<TCustomerSchema> = {},
  ): TCustomerSchema {
    return {
      name: 'Test Customer',
      customer_id: 1,
      seller_id: 1,
      billing_address: '123 Test Street, Test City, TC 12345',
      project_address: '456 Project Street, Project City, PC 67890',
      same_address: false,

      notes_to_sale: 'Test notes',
      price: 5000,
      company_name: 'Test Company',
      extras: [],
      rooms: [TestDataFactory.createRoom()],
      ...overrides,
    }
  }

  static createRoom(overrides: Partial<TRoomSchema> = {}): TRoomSchema {
    return {
      room: 'kitchen',
      room_id: 'dcdd9054-dadd-431d-a861-d0639f70f67b',
      sink_type: [{ id: 1, type_id: 1 }],
      faucet_type: [{ id: 1, type_id: 1 }],
      edge: 'Flat',
      backsplash: 'No',
      square_feet: 25,
      retail_price: 2500,
      total_price: 2500,
      tear_out: 'No',
      stove: 'F/S',
      waterfall: 'No',
      corbels: 0,
      seam: 'Standard',
      ten_year_sealer: false,
      slabs: [{ id: 1, is_full: true }],
      extras: {
        edge_price: 0,
        tear_out_price: 0,
        stove_price: 0,
        waterfall_price: 0,
        corbels_price: 0,
        seam_price: 0,
      },
      ...overrides,
    }
  }

  static async createTestCompany(): Promise<number> {
    return await DatabaseTestHelper.insertTestData('company', {
      name: 'Test Company',
      created_date: new Date(),
    })
  }

  static async createTestUser(companyId: number): Promise<number> {
    return await DatabaseTestHelper.insertTestData('users', {
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      is_employee: 1,
      is_admin: 0,
      is_superuser: 0,
      company_id: companyId,
      created_date: new Date(),
    })
  }

  static async createTestCustomer(companyId: number): Promise<number> {
    return await DatabaseTestHelper.insertTestData('customers', {
      name: 'Test Customer',
      company_id: companyId,
      phone: '555-123-4567',
      email: 'customer@test.com',
      address: '123 Test Street, Test City, TC 12345',
      postal_code: '12345',
      created_date: new Date(),
    })
  }

  static async createTestStone(companyId: number): Promise<number> {
    return await DatabaseTestHelper.insertTestData('stones', {
      name: 'Test Stone',
      type: 'Granite',
      company_id: companyId,
      created_date: new Date(),
    })
  }

  static async createTestSlab(stoneId: number): Promise<number> {
    return await DatabaseTestHelper.insertTestData('slab_inventory', {
      stone_id: stoneId,
      bundle: 'A',
      length: 10,
      width: 5,
      url: 'https://example.com/slab.jpg',
      created_at: new Date(),
    })
  }

  static async createTestSinkType(companyId: number): Promise<number> {
    return await DatabaseTestHelper.insertTestData('sink_type', {
      name: 'Test Sink Type',
      retail_price: 500,
      url: 'https://example.com/slab.jpg',
      type: 'Slab',
      length: 10,
      width: 5,
      depth: 1,
      company_id: companyId,
      // created_date: new Date(),
    })
  }

  static async createTestSink(sinkTypeId: number): Promise<number> {
    return await DatabaseTestHelper.insertTestData('sinks', {
      sink_type_id: sinkTypeId,
      is_deleted: 0,
      created_date: new Date(),
    })
  }

  static async createTestFaucetType(companyId: number): Promise<number> {
    return await DatabaseTestHelper.insertTestData('faucet_type', {
      name: 'Test Faucet Type',
      retail_price: 300,
      url: 'https://example.com/slab.jpg',
      type: 'Slab',
      company_id: companyId,
    })
  }

  static async createTestFaucet(faucetTypeId: number): Promise<number> {
    return await DatabaseTestHelper.insertTestData('faucets', {
      faucet_type_id: faucetTypeId,
      is_deleted: 0,
    })
  }
}
