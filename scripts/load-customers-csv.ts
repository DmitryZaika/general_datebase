// load-customers-csv.js

import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config()

const access = {
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
}
export const db = mysql.createPool(access)

const __dirname = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')
const CSV_PATH = path.join(__dirname, 'data.csv') // при желании укажи абсолютный путь

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
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
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

// --- CSV: читаем как есть, только детект разделителя, без алиасов -----------------
function getCsvData() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`File not found: ${CSV_PATH}`)
  }

  // читаем как utf8, если упадёт — latin1
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

  // ВАЖНО: ожидаем именно английские заголовки в нижнем регистре:
  // created_date,name,phone,email,address,sales_rep
  const headers = first.split(delim).map(h => h.trim())
  const needed = ['created_date', 'name', 'phone', 'email', 'address', 'sales_rep']

  // Проверяем строгое соответствие (без алиасов)
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
    source: item.source ?? 'leads',
  }))
}

// ---- загрузка существующих телефонов/email из БД и нормализация ------------------
async function loadExistingIdentifiers({ companyId = 1 } = {}) {
  const conn = await db.getConnection()
  try {
    // Если нужно ограничивать по компании — оставляем WHERE company_id = ?
    const [rows] = await conn.query(
      `SELECT phone, email FROM customers WHERE company_id = ?`,
      [companyId]
    )

    const existingPhones = new Set()
    const existingEmails = new Set()

    for (const r of rows) {
      // нормализуем то, что лежит в базе (на всякий случай поддержим любые форматы)
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
    // пропускаем запись, если нет и телефона, и email
    if (!r.phone && !r.email) {
      skippedNoContact++
      continue
    }

    // проверяем дубли по телефону/email
    const phoneDup = r.phone && batchPhones.has(r.phone)
    const emailDup = r.email && batchEmails.has(r.email)

    if (phoneDup || emailDup) {
      skippedDuplicates++
      continue
    }

    // новая уникальная запись — добавляем и учитываем в сетах,
    // чтобы внутри текущей загрузки тоже не было дублей
    if (r.phone) batchPhones.add(r.phone)
    if (r.email) batchEmails.add(r.email)
    result.push(r)
  }

  return { filtered: result, skippedDuplicates, skippedNoContact }
}

async function saveData(data) {
 
  const sql = `
    INSERT INTO customers
      (created_date, name, phone, email, address, sales_rep, company_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
 
  const conn = await db.getConnection()
 
  let _inserted = 0
  
  try {
    await conn.beginTransaction()
  
    for (const r of data) {

      await conn.execute(sql, [
        r.created_date,
        r.name,
        r.phone,
        r.email,
        r.address,
        r.sales_rep,
        1,
        'leads',
      ])
    
      _inserted++
    }
  
    await conn.commit()
  
  } catch (e) {
    await conn.rollback()
    
    throw e
  } finally {
    conn.release()
    
    await db.end()
  }
 
  return _inserted
}

// --- run --------------------------------------------------------
// biome-ignore lint/suspicious/noConsole: for tests
console.log('customers import started')

const rawData = getCsvData()
const cleanData = convertData(rawData)
// biome-ignore lint/suspicious/noConsole: for tests
console.log('customers cleanData count', cleanData.length)

const { existingPhones, existingEmails } = await loadExistingIdentifiers({ companyId: 1 })
const { filtered, skippedDuplicates, skippedNoContact } = filterDuplicates(
  cleanData,
  existingPhones,
  existingEmails
)

// biome-ignore lint/suspicious/noConsole: for tests
console.log(
  `filtered to insert: ${filtered.length} (skipped duplicates: ${skippedDuplicates}, skipped no phone+email: ${skippedNoContact})`
)

const inserted = await saveData(filtered)
// biome-ignore lint/suspicious/noConsole: for tests
console.log(`customers import finished, inserted: ${inserted}`)
