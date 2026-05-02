import { type ActionFunctionArgs, data } from 'react-router'
import { transitionDealStage } from '~/crud/deals'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return data({ error: 'method' }, { status: 405 })
  await getEmployeeUser(request)

  const form = await request.formData()
  const id = Number(form.get('id'))
  const toList = Number(form.get('toList'))
  if (!id || !toList) return data({ error: 'bad payload' }, { status: 400 })

  const prevRows = await selectMany<{ list_id: number; is_won: number | null }>(
    db,
    'SELECT list_id, is_won FROM deals WHERE id = ? LIMIT 1',
    [id],
  )
  const prevListId = prevRows[0]?.list_id
  const prevIsWon = prevRows[0]?.is_won
  const fromClosed = prevIsWon === 1 || prevIsWon === 0

  const movedAcross = prevListId !== undefined && prevListId !== toList

  let changeIsWon = 0
  let isWonVal: number | null = null
  if (movedAcross && fromClosed) {
    changeIsWon = 1
    isWonVal = null
  }
  const clearLostReason = movedAcross && fromClosed

  await db.execute(
    `UPDATE deals
     SET list_id = ?,
         is_won = IF(? = 1, ?, is_won),
         lost_reason = IF(?, NULL, lost_reason),
         updated_at = NOW()
     WHERE id = ?`,
    [toList, changeIsWon, isWonVal, clearLostReason ? 1 : 0, id],
  )

  if (movedAcross) {
    await transitionDealStage(id, toList)
  }

  return data({ ok: true })
}
