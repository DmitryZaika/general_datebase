import type { PoolConnection } from 'mysql2/promise'
import { db } from '~/db.server'
import { TERMINAL_LIST_IDS } from '~/utils/constants'

export async function closeDealStageHistory(
  dealId: number,
  conn: PoolConnection | typeof db = db,
) {
  await conn.execute(
    'UPDATE deal_stage_history SET exited_at = NOW() WHERE deal_id = ? AND exited_at IS NULL',
    [dealId],
  )
}

export async function transitionDealStage(dealId: number, toListId: number) {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await closeDealStageHistory(dealId, conn)
    if (TERMINAL_LIST_IDS.includes(toListId)) {
      await conn.execute(
        'INSERT INTO deal_stage_history (deal_id, list_id, exited_at) VALUES (?, ?, NOW())',
        [dealId, toListId],
      )
    } else {
      await conn.execute(
        'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
        [dealId, toListId],
      )
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function reopenDealStageHistory(dealId: number) {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await closeDealStageHistory(dealId, conn)
    const [rawRows] = await conn.execute(
      'SELECT list_id FROM deals WHERE id = ? LIMIT 1',
      [dealId],
    )
    const rows = rawRows as { list_id: number }[]
    if (rows.length > 0 && !TERMINAL_LIST_IDS.includes(rows[0].list_id)) {
      await conn.execute(
        'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
        [dealId, rows[0].list_id],
      )
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function reactivateDeal(dealId: number) {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [dealRaw] = await conn.execute(
      `SELECT d.list_id, l.group_id
       FROM deals d
       JOIN deals_list l ON d.list_id = l.id
       WHERE d.id = ? LIMIT 1 FOR UPDATE`,
      [dealId],
    )
    const dealRows = dealRaw as { list_id: number; group_id: number }[]
    if (dealRows.length === 0) {
      await conn.commit()
      return
    }

    const { list_id, group_id } = dealRows[0]

    if (!TERMINAL_LIST_IDS.includes(list_id)) {
      await closeDealStageHistory(dealId, conn)
      if (!TERMINAL_LIST_IDS.includes(list_id)) {
        await conn.execute(
          'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
          [dealId, list_id],
        )
      }
      await conn.commit()
      return
    }

    const [histRaw] = await conn.execute(
      `SELECT dsh.list_id FROM deal_stage_history dsh
       JOIN deals_list l ON dsh.list_id = l.id AND l.deleted_at IS NULL
       WHERE dsh.deal_id = ? AND dsh.list_id NOT IN (?, ?)
       ORDER BY dsh.entered_at DESC LIMIT 1`,
      [dealId, ...TERMINAL_LIST_IDS],
    )
    const historyRows = histRaw as { list_id: number }[]

    let targetListId: number

    if (historyRows.length > 0) {
      targetListId = historyRows[0].list_id
    } else {
      const [groupRaw] = await conn.execute(
        'SELECT id FROM deals_list WHERE group_id = ? AND deleted_at IS NULL ORDER BY position ASC LIMIT 1',
        [group_id],
      )
      const groupRows = groupRaw as { id: number }[]
      if (groupRows.length === 0) {
        await conn.commit()
        return
      }
      targetListId = groupRows[0].id
    }

    await conn.execute('UPDATE deals SET list_id = ? WHERE id = ?', [
      targetListId,
      dealId,
    ])
    await closeDealStageHistory(dealId, conn)
    await conn.execute(
      'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
      [dealId, targetListId],
    )
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
