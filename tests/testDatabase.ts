import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import type { TCustomerSchema, TRoomSchema } from '~/schemas/sales'
import type { Nullable } from '~/types/utils'
import type { SessionUser, User } from '~/utils/session.server'

dotenv.config()

export const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE ? `${process.env.DB_DATABASE}_test` : 'test_db',
  multipleStatements: true,
}

// Minimal DDL for the SMS-related tables. The harness doesn't run the full
// migration set, so each test opts in via helper.setup() and gets just these.
const SMS_TEST_SCHEMA_DDL = [
  `CREATE TABLE IF NOT EXISTS company (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NULL,
    name VARCHAR(255) NULL,
    phone_number VARCHAR(100) NULL,
    is_employee TINYINT(1) DEFAULT 0,
    is_admin TINYINT(1) DEFAULT 0,
    is_superuser TINYINT(1) DEFAULT 0,
    company_id INT NULL,
    cloudtalk_agent_id VARCHAR(64) NULL,
    cloudtalk_phone_number VARCHAR(20) NULL,
    pined_bar INT DEFAULT 0,
    is_deleted TINYINT(1) DEFAULT 0,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    phone_2 VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    address VARCHAR(255) NULL,
    postal_code VARCHAR(20) NULL,
    company_id INT NULL,
    deleted_at TIMESTAMP NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cloudtalk_sms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cloudtalk_id INT NULL,
    sender BIGINT NULL,
    recipient BIGINT NOT NULL,
    text TEXT NOT NULL,
    direction ENUM('inbound','outbound') NOT NULL DEFAULT 'inbound',
    status ENUM('received','sent','failed','pending') NOT NULL DEFAULT 'received',
    error_message TEXT NULL,
    idempotency_key VARCHAR(36) NULL,
    agent VARCHAR(255) NULL,
    sender_user_id INT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    company_id INT NULL,
    KEY idx_cloudtalk_sms_company_phones (company_id, sender, recipient),
    KEY idx_cloudtalk_sms_company_created (company_id, created_date),
    KEY idx_cloudtalk_sms_sender_user (sender_user_id),
    UNIQUE KEY uniq_cloudtalk_id_per_company (company_id, cloudtalk_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cloudtalk_sms_thread_reads (
    user_id INT NOT NULL,
    company_id INT NOT NULL,
    customer_phone_digits VARCHAR(20) NOT NULL,
    last_read_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, company_id, customer_phone_digits)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cloudtalk_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    company_id INT NOT NULL,
    cloudtalk_id BIGINT NOT NULL,
    phone_e164_1 VARCHAR(20) NULL,
    phone_e164_2 VARCHAR(20) NULL,
    last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error TEXT NULL,
    UNIQUE KEY uniq_customer (customer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
]

const SMS_TEST_TABLES = [
  'cloudtalk_sms_thread_reads',
  'cloudtalk_sms',
  'cloudtalk_contacts',
  'customers',
  'users',
  'company',
]

export interface SmsTestUser extends SessionUser {
  cloudtalk_agent_id: Nullable<string>
  cloudtalk_phone_number: Nullable<string>
}

export class DatabaseTestHelper {
  static connection: Nullable<mysql.Connection> = null

  // Instance methods are used by the new SMS tests; the static API below is
  // kept intact for legacy callers (notably contract.test.ts).
  async setup(): Promise<void> {
    await DatabaseTestHelper.ensureDatabase()
    // Reopen the cached connection — mysql2 caches prepared statements per
    // connection and they survive DROP/CREATE, which produces "Unknown column"
    // errors when the schema evolves between test runs.
    if (DatabaseTestHelper.connection) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: end() may reject if already closed; swallow
      await DatabaseTestHelper.connection.end().catch(() => {})
      DatabaseTestHelper.connection = null
    }
    const connection = await DatabaseTestHelper.connect()
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of SMS_TEST_TABLES) {
      await connection.query(`DROP TABLE IF EXISTS ${table}`)
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    for (const ddl of SMS_TEST_SCHEMA_DDL) {
      await connection.query(ddl)
    }
  }

  async teardown(): Promise<void> {
    await DatabaseTestHelper.clearSmsTables()
  }

  async query<T = mysql.RowDataPacket>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const connection = await DatabaseTestHelper.connect()
    const [rows] = await connection.query(sql, params)
    return rows as T[]
  }

  static async ensureDatabase(): Promise<void> {
    const root = await mysql.createConnection({
      host: TEST_DB_CONFIG.host,
      user: TEST_DB_CONFIG.user,
      password: TEST_DB_CONFIG.password,
      multipleStatements: true,
    })
    try {
      await root.query(`CREATE DATABASE IF NOT EXISTS ${TEST_DB_CONFIG.database}`)
    } finally {
      await root.end()
    }
  }

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
      await new Promise(resolve => setTimeout(resolve, 100))
    } finally {
      await connection.end()
    }
  }

  static async clearAllTables(): Promise<void> {
    const connection = await DatabaseTestHelper.connect()
    const [tables] = await connection.execute(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = '${TEST_DB_CONFIG.database}'
        AND table_type = 'BASE TABLE'
      `)

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of tables as mysql.RowDataPacket[]) {
      await connection.execute(`DELETE FROM ${table.TABLE_NAME}`)
    }
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1')
  }

  static async clearSmsTables(): Promise<void> {
    const connection = await DatabaseTestHelper.connect()
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of SMS_TEST_TABLES) {
      await connection.query(`DELETE FROM ${table}`)
      await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`)
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
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

interface CompanyOverrides {
  name?: string
}

interface UserOverrides {
  email?: string
  name?: string
  phone_number?: string
  is_employee?: boolean
  is_admin?: boolean
  is_superuser?: boolean
  company_id?: number
  cloudtalk_agent_id?: Nullable<string>
  cloudtalk_phone_number?: Nullable<string>
}

interface SmsInboundOverrides {
  company_id: number
  sender: string
  recipient?: string
  text?: string
  agent?: Nullable<string>
  cloudtalk_id?: Nullable<number>
  created_date?: Date
}

interface SmsOutboundOverrides {
  company_id: number
  recipient: string
  sender_user_id: number
  text?: string
  agent?: Nullable<string>
  cloudtalk_id?: Nullable<number>
  status?: 'sent' | 'failed' | 'pending'
  error_message?: Nullable<string>
  created_date?: Date
}

interface CustomerOverrides {
  company_id: number
  name?: string
  phone?: string
  phone_2?: Nullable<string>
}

interface CloudtalkContactOverrides {
  customer_id: number
  company_id: number
  cloudtalk_id: number
  phone_e164_1?: Nullable<string>
  phone_e164_2?: Nullable<string>
}

interface CompanyRow {
  id: number
}

interface CloudtalkContactRow {
  id: number
  customer_id: number
  company_id: number
  cloudtalk_id: number
}

interface SmsRow {
  id: number
  cloudtalk_id: Nullable<number>
  sender: Nullable<string>
  recipient: string
  text: string
  direction: 'inbound' | 'outbound'
  status: 'received' | 'sent' | 'failed'
  error_message: Nullable<string>
  agent: Nullable<string>
  sender_user_id: Nullable<number>
  created_date: string
  company_id: Nullable<number>
}

interface CustomerRow {
  id: number
  company_id: number
  name: string
  phone: Nullable<string>
}

function toMysqlDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export class TestDataFactory {
  // Instance API used by the SMS tests. Wraps DatabaseTestHelper so callers
  // can write `factory.company()` / `factory.user({...})`.
  constructor(private readonly helper: DatabaseTestHelper) {}

  async company(overrides: CompanyOverrides = {}): Promise<CompanyRow> {
    const id = await DatabaseTestHelper.insertTestData('company', {
      name: overrides.name ?? `Test Company ${Date.now()}`,
      created_date: new Date(),
    })
    return { id }
  }

  async user(overrides: UserOverrides = {}): Promise<SmsTestUser> {
    const isAdmin = overrides.is_admin ?? false
    const isEmployee = overrides.is_employee ?? !isAdmin
    const id = await DatabaseTestHelper.insertTestData('users', {
      email: overrides.email ?? `user${Date.now()}_${Math.random()}@test.local`,
      name: overrides.name ?? 'Test User',
      phone_number: overrides.phone_number ?? '+10000000000',
      is_employee: isEmployee ? 1 : 0,
      is_admin: isAdmin ? 1 : 0,
      is_superuser: overrides.is_superuser ? 1 : 0,
      company_id: overrides.company_id ?? 1,
      cloudtalk_agent_id: overrides.cloudtalk_agent_id ?? null,
      cloudtalk_phone_number: overrides.cloudtalk_phone_number ?? null,
    })
    return {
      id,
      email: overrides.email ?? `user${id}@test.local`,
      name: overrides.name ?? 'Test User',
      phone_number: overrides.phone_number ?? '+10000000000',
      is_employee: isEmployee,
      is_admin: isAdmin,
      is_superuser: overrides.is_superuser ?? false,
      company_id: overrides.company_id ?? 1,
      pined_bar: 0,
      cloudtalk_agent_id: overrides.cloudtalk_agent_id ?? null,
      cloudtalk_phone_number: overrides.cloudtalk_phone_number ?? null,
    }
  }

  async smsInbound(overrides: SmsInboundOverrides): Promise<SmsRow> {
    const id = await DatabaseTestHelper.insertTestData('cloudtalk_sms', {
      company_id: overrides.company_id,
      sender: overrides.sender,
      recipient: overrides.recipient ?? '5550000000',
      text: overrides.text ?? 'inbound test',
      direction: 'inbound',
      status: 'received',
      agent: overrides.agent ?? null,
      cloudtalk_id: overrides.cloudtalk_id ?? null,
      created_date: overrides.created_date
        ? toMysqlDate(overrides.created_date)
        : toMysqlDate(new Date()),
    })
    const rows = await this.helper.query<SmsRow>(
      'SELECT * FROM cloudtalk_sms WHERE id = ?',
      [id],
    )
    return rows[0]
  }

  async smsOutbound(overrides: SmsOutboundOverrides): Promise<SmsRow> {
    const id = await DatabaseTestHelper.insertTestData('cloudtalk_sms', {
      company_id: overrides.company_id,
      sender: null,
      recipient: overrides.recipient,
      text: overrides.text ?? 'outbound test',
      direction: 'outbound',
      status: overrides.status ?? 'sent',
      error_message: overrides.error_message ?? null,
      agent: overrides.agent ?? null,
      sender_user_id: overrides.sender_user_id,
      cloudtalk_id: overrides.cloudtalk_id ?? null,
      created_date: overrides.created_date
        ? toMysqlDate(overrides.created_date)
        : toMysqlDate(new Date()),
    })
    const rows = await this.helper.query<SmsRow>(
      'SELECT * FROM cloudtalk_sms WHERE id = ?',
      [id],
    )
    return rows[0]
  }

  async customer(overrides: CustomerOverrides): Promise<CustomerRow> {
    const id = await DatabaseTestHelper.insertTestData('customers', {
      name: overrides.name ?? 'Test Customer',
      phone: overrides.phone ?? null,
      phone_2: overrides.phone_2 ?? null,
      company_id: overrides.company_id,
      created_date: new Date(),
    })
    return {
      id,
      company_id: overrides.company_id,
      name: overrides.name ?? 'Test Customer',
      phone: overrides.phone ?? null,
    }
  }

  async cloudtalkContact(
    overrides: CloudtalkContactOverrides,
  ): Promise<CloudtalkContactRow> {
    const id = await DatabaseTestHelper.insertTestData('cloudtalk_contacts', {
      customer_id: overrides.customer_id,
      company_id: overrides.company_id,
      cloudtalk_id: overrides.cloudtalk_id,
      phone_e164_1: overrides.phone_e164_1 ?? null,
      phone_e164_2: overrides.phone_e164_2 ?? null,
    })
    return {
      id,
      customer_id: overrides.customer_id,
      company_id: overrides.company_id,
      cloudtalk_id: overrides.cloudtalk_id,
    }
  }

  // Legacy static API kept intact for contract.test.ts and similar callers.
  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      phone_number: '+1234567890',
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
      customer_id: 1,
      seller_id: 1,
      project_address: '456 Project Street, Project City, PC 67890',
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
      sink_type: [{ id: 1, type_id: 1, price: 0 }],
      faucet_type: [{ id: 1, type_id: 1, price: 0 }],
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
        edge_price: {
          edge_type: 'Flat',
          edge_price: 0,
        },
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
