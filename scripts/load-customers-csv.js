// load-customers-csv.js

import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

dotenv.config()

const access = {
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
}
const db = mysql.createPool(access)

const __dirname = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')
const CSV_PATH = path.join(__dirname, 'data.csv')

const BATCH_SIZE = 500

// --- helpers ----------------------------------------------------
function detectDelimiter(headerLine) {
  const sc = (headerLine.match(/;/g) || []).length
  const cm = (headerLine.match(/,/g) || []).length
  return sc > cm ? ';' : ','
}

function normalizePhone(val) {
  if (val == null) return null
  const d = String(val).replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1'))
    return `${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return null
}

function normalizeEmail(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.toLowerCase()
}

// "dd.mm.yyyy[ HH:MM[:SS]]" | "yyyy-mm-dd[ HH:MM[:SS]]" -> "YYYY-MM-DD HH:MM:SS"
function normalizeDateKeepTime(s) {
  if (!s) return null
  const t = String(s).trim()

  // dd.mm.yyyy [time]
  let m = t.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  )
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    const yyyy = m[3]
    const hh = (m[4] ?? '0').padStart(2, '0')
    const mi = (m[5] ?? '0').padStart(2, '0')
    const ss = (m[6] ?? '0').padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  // yyyy-mm-dd [time]
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (m) {
    const yyyy = m[1],
      mm = m[2],
      dd = m[3]
    const hh = (m[4] ?? '0').padStart(2, '0')
    const mi = (m[5] ?? '0').padStart(2, '0')
    const ss = (m[6] ?? '0').padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  return null
}

function toInt(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// --- interactive prompt -----------------------------------------
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// --- CSV --------------------------------------------------------
function getCsvData() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`File not found: ${CSV_PATH}`)
  }

  let raw
  try {
    raw = fs.readFileSync(CSV_PATH, 'utf8')
  } catch {
    raw = fs.readFileSync(CSV_PATH, 'latin1')
  }

  const text = raw.replace(/^\uFEFF/, '').trim()
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []

  const first = lines[0]
  const delim = detectDelimiter(first)

  // created_date,name,phone,email,address,sales_rep
  const headers = first.split(delim).map(h => h.trim())
  const needed = ['created_date', 'name', 'phone', 'email', 'address', 'sales_rep']

  const idx = Object.fromEntries(needed.map(h => [h, headers.indexOf(h)]))
  for (const h of needed) {
    if (idx[h] === -1) {
      throw new Error(`Missing required column: ${h}. Got: ${headers.join(', ')}`)
    }
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delim)
    if (!parts.length) continue
    const row = {}
    for (const h of needed) {
      const pos = idx[h]
      const val = pos >= 0 && pos < parts.length ? parts[pos].trim() : ''
      row[h] = val === '' ? null : val
    }
    rows.push(row)
  }
  return rows
}

function convertData(data) {
  return data.map(item => ({
    created_date: normalizeDateKeepTime(item.created_date),
    name: item.name ?? null,
    phone: normalizePhone(item.phone ?? null),
    email: normalizeEmail(item.email ?? null),
    address: item.address ?? null,
    sales_rep: toInt(item.sales_rep),
    source: 'leads',
  }))
}

// --- existing identifiers ---------------------------------------
async function loadExistingIdentifiers(companyId) {
  const conn = await db.getConnection()
  try {
    const [rows] = await conn.query(
      `SELECT phone, email FROM customers WHERE company_id = ?`,
      [companyId],
    )

    const existingPhones = new Set()
    const existingEmails = new Set()

    for (const r of rows) {
      const p = normalizePhone(r.phone)
      if (p) existingPhones.add(p)
      const e = normalizeEmail(r.email)
      if (e) existingEmails.add(e)
    }

    return { existingPhones, existingEmails }
  } finally {
    conn.release()
  }
}

function filterDuplicates(data, existingPhones, existingEmails) {
  const batchPhones = new Set(existingPhones)
  const batchEmails = new Set(existingEmails)

  const result = []
  let skippedNoContact = 0
  let skippedDuplicates = 0

  for (const r of data) {
    if (!r.phone && !r.email) {
      skippedNoContact++
      continue
    }

    const phoneDup = r.phone && batchPhones.has(r.phone)
    const emailDup = r.email && batchEmails.has(r.email)

    if (phoneDup || emailDup) {
      skippedDuplicates++
      continue
    }

    if (r.phone) batchPhones.add(r.phone)
    if (r.email) batchEmails.add(r.email)
    result.push(r)
  }

  return { filtered: result, skippedDuplicates, skippedNoContact }
}

// --- batch insert -----------------------------------------------
async function saveData(data, companyId) {
  if (data.length === 0) return 0

  const columns = ['created_date', 'name', 'phone', 'email', 'address', 'sales_rep', 'company_id', 'source']
  const placeholders = columns.map(() => '?').join(', ')

  const conn = await db.getConnection()
  let inserted = 0

  try {
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const chunk = data.slice(i, i + BATCH_SIZE)
      const valueTuples = chunk
        .map(() => `(${placeholders})`)
        .join(', ')

      const sql = `INSERT INTO customers (${columns.join(', ')}) VALUES ${valueTuples}`

      const params = []
      for (const r of chunk) {
        params.push(
          r.created_date,
          r.name,
          r.phone,
          r.email,
          r.address,
          r.sales_rep,
          companyId,
          r.source,
        )
      }

      await conn.execute(sql, params)
      inserted += chunk.length
    }
  } finally {
    conn.release()
    await db.end()
  }

  return inserted
}

// --- run --------------------------------------------------------
// biome-ignore lint/suspicious/noConsole: for tests
console.log('=== Customers CSV Import ===\n')

const companyIdInput = await ask('Enter company ID: ')
const companyId = Number(companyIdInput)
if (!Number.isFinite(companyId) || companyId <= 0) {
  console.error('Invalid company ID')
  process.exit(1)
}

let dbCompanyName
{
  const conn = await db.getConnection()
  try {
    const [companyRows] = await conn.query(
      'SELECT name FROM company WHERE id = ?',
      [companyId],
    )
    if (!companyRows.length) {
      console.error(`No company found with ID ${companyId}`)
      await db.end()
      process.exit(1)
    }
    dbCompanyName = companyRows[0].name
  } finally {
    conn.release()
  }
}

const enteredName = await ask(
  `Please enter the name of the company you add leads: '${dbCompanyName}' -> `,
)
if (enteredName !== dbCompanyName) {
  console.error(
    `Company name mismatch: you entered "${enteredName}", but the company with ID ${companyId} is "${dbCompanyName}"`,
  )
  await db.end()
  process.exit(1)
}

// biome-ignore lint/suspicious/noConsole: for tests
console.log(`\nImporting to: ${dbCompanyName} (ID: ${companyId})\n`)

const dbName = process.env.DB_DATABASE ?? 'unknown'
const confirmDb = await ask(
  `You are adding leads to the main database '${dbName}' — is this correct? (yes/no) -> `,
)
if (confirmDb.toLowerCase() !== 'yes' && confirmDb.toLowerCase() !== 'y') {
  console.error('Import aborted by user')
  await db.end()
  process.exit(1)
}

const rawData = getCsvData()
const cleanData = convertData(rawData)
// biome-ignore lint/suspicious/noConsole: for tests
console.log(`CSV rows parsed: ${cleanData.length}`)

const { existingPhones, existingEmails } = await loadExistingIdentifiers(companyId)
const { filtered, skippedDuplicates, skippedNoContact } = filterDuplicates(
  cleanData,
  existingPhones,
  existingEmails,
)

// biome-ignore lint/suspicious/noConsole: for tests
console.log(
  `Filtered to insert: ${filtered.length} (skipped duplicates: ${skippedDuplicates}, skipped no phone+email: ${skippedNoContact})`,
)

const inserted = await saveData(filtered, companyId)
// biome-ignore lint/suspicious/noConsole: for tests
console.log(`Import finished, inserted: ${inserted} customers into ${dbCompanyName}`)
