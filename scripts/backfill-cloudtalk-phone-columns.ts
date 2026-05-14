import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import type { Nullable } from '../app/types/utils'
import { normalizeToE164 } from '../app/utils/phone'

dotenv.config()

const PROGRESS_EVERY = 100

interface Row extends mysql.RowDataPacket {
  id: number
  phone: Nullable<string>
  phone_2: Nullable<string>
}

async function main(): Promise<void> {
  const pool = mysql.createPool({
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
  })
  try {
    const [rows] = await pool.query<Row[]>(
      `SELECT cc.id, c.phone, c.phone_2
         FROM cloudtalk_contacts cc
         JOIN customers c ON c.id = cc.customer_id
        WHERE cc.phone_e164_1 IS NULL AND cc.phone_e164_2 IS NULL`,
    )
    console.log(`Backfilling ${rows.length} cloudtalk_contacts rows...`)
    let updated = 0
    let skipped = 0
    for (const [i, r] of rows.entries()) {
      const e164_1 = normalizeToE164(r.phone)
      const e164_2 = normalizeToE164(r.phone_2)
      if (e164_1 === null && e164_2 === null) {
        skipped += 1
        continue
      }
      await pool.execute(
        'UPDATE cloudtalk_contacts SET phone_e164_1 = ?, phone_e164_2 = ? WHERE id = ?',
        [e164_1, e164_2, r.id],
      )
      updated += 1
      if ((i + 1) % PROGRESS_EVERY === 0) {
        console.log(`Progress: ${i + 1}/${rows.length} (updated=${updated}, skipped=${skipped})`)
      }
    }
    console.log(`Done. updated=${updated}, skipped=${skipped}, total=${rows.length}`)
  } finally {
    await pool.end()
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Backfill crashed:', error)
    process.exit(1)
  })
