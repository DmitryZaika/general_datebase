// migrate-deals.js

import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config()

const access = {
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
}

export const db = mysql.createPool(access)

async function migrateDeals() {
  const conn = await db.getConnection()
  console.log('Migration started...')

  try {
    await conn.beginTransaction()

    // 1. Handle "Closed Won" (List ID 4)
    // ТЕПЕРЬ: Ставим is_won = 1 И переносим в "Got a Quote" (ID 3)
    const [wonResult] = await conn.execute(
      `UPDATE deals SET is_won = 1, list_id = 3 WHERE list_id = 4`,
    )
    console.log(`Moved 'Won' deals to 'Got a Quote': ${wonResult.affectedRows}`)

    // 2. Handle "Closed Lost" (List ID 5)
    // First, fetch all lost deals to process logic in JS
    const [lostDeals] = await conn.query(
      `SELECT id, lost_reason FROM deals WHERE list_id = 5`,
    )

    let updatedCount = 0
    let fallbackCounter = 0 // Счетчик для равномерного распределения "остальных"

    for (const deal of lostDeals) {
      let newListId = null
      const reason = deal.lost_reason

      // --- Logic mapping ---

      if (reason === 'Too expensive') {
        newListId = 3 // Got a Quote
      } else if (
        [
          'Out of area',
          'Accident submission',
          'Looking for unrelated service',
          'Looking for unrelated servide',
        ].includes(reason)
      ) {
        newListId = 2 // Contacted
      } else if (['Never responded', 'Wrong number, email, etc.'].includes(reason)) {
        newListId = 1 // New Customer
      } else if (reason === 'Bought somewhere else') {
        // Rotate: Got a quote (3), On Hold (6), Contacted (2)
        const rotation = [3, 6, 2]
        newListId = rotation[deal.id % 3]
      } else if (reason === 'Stopped responding') {
        // Rotate: Got a quote (3), Contacted (2), On Hold (6)
        const rotation = [3, 2, 6]
        newListId = rotation[deal.id % 3]
      } else {
        // === ЛЮБАЯ ДРУГАЯ ПРИЧИНА (или пусто) ===
        // Распределяем по очереди между: 1 (New), 2 (Contacted), 3 (Quote), 6 (On Hold)
        const allLists = [1, 2, 3, 6]

        newListId = allLists[fallbackCounter % allLists.length]
        fallbackCounter++
      }

      // --- Execute Update ---

      if (newListId !== null) {
        // Для Lost сделок ставим is_won = 0 и новый list_id
        await conn.execute(`UPDATE deals SET list_id = ?, is_won = 0 WHERE id = ?`, [
          newListId,
          deal.id,
        ])
        updatedCount++
      }
    }
    // 3. Soft-delete the "Closed Won" and "Closed Lost" lists (OUTSIDE the loop)
    const [listResult] = await conn.execute(
      `UPDATE deals_list SET deleted_at = NOW() WHERE id IN (4, 5)`,
    )
    console.log(`Soft-deleted lists 4 and 5: ${listResult.affectedRows} rows updated.`)

    console.log(`Processed and moved 'Lost' deals: ${updatedCount}`)

    await conn.commit()
    console.log('Migration committed successfully.')
  } catch (err) {
    await conn.rollback()
    console.error('Migration failed, changes rolled back.', err)
  } finally {
    conn.release()
    await db.end()
  }
}

migrateDeals()
