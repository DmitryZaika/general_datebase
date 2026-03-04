import { type ActionFunctionArgs, data } from 'react-router'
import { transitionDealStage } from '~/crud/deals'
import { db } from '~/db.server'
import {
  CLOSED_LOST_LIST_ID,
  CLOSED_WON_LIST_ID,
  TERMINAL_LIST_IDS,
} from '~/utils/constants'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const form = await request.formData()
  const id = Number(form.get('id'))
  const toList = Number(form.get('toList'))
  if (!id || !toList) return data({ error: 'bad payload' }, { status: 400 })

  const prevRows = await selectMany<{ list_id: number }>(
    db,
    'SELECT list_id FROM deals WHERE id = ? LIMIT 1',
    [id],
  )
  const prevListId = prevRows[0]?.list_id

  const movedAcross = prevListId !== undefined && prevListId !== toList
  const fromTerminal =
    prevListId !== undefined && TERMINAL_LIST_IDS.includes(prevListId)

  let changeIsWon = 0
  let isWonVal: number | null = null
  if (movedAcross) {
    if (toList === CLOSED_WON_LIST_ID) {
      changeIsWon = 1
      isWonVal = 1
    } else if (toList === CLOSED_LOST_LIST_ID) {
      changeIsWon = 1
      isWonVal = 0
    } else if (fromTerminal) {
      changeIsWon = 1
      isWonVal = null
    }
  }
  const clearLostReason = movedAcross && (toList === CLOSED_WON_LIST_ID || fromTerminal)

  await db.execute(
    `UPDATE deals
     SET list_id = ?,
         due_date = IF(? IN (?, ?), NULL, due_date),
         is_won = IF(? = 1, ?, is_won),
         lost_reason = IF(?, NULL, lost_reason),
         updated_at = NOW()
     WHERE id = ?`,
    [
      toList,
      toList,
      CLOSED_WON_LIST_ID,
      CLOSED_LOST_LIST_ID,
      changeIsWon,
      isWonVal,
      clearLostReason ? 1 : 0,
      id,
    ],
  )

  if (movedAcross) {
    await transitionDealStage(id, toList)
  }

  return data({ ok: true })
}
