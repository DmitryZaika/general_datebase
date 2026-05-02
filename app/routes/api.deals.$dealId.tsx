import { zodResolver } from '@hookform/resolvers/zod'
import type { RowDataPacket } from 'mysql2'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { transitionDealStage } from '~/crud/deals'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

export async function action({ request, params }: ActionFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  const resolver = zodResolver(dealsSchema)

  const { errors, data, receivedValues } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors, receivedValues }
  }
  const dealId = parseInt(params.dealId || '0', 10)
  if (!dealId) return { error: 'Invalid deal id' }

  const prevRows = await selectMany<{ list_id: number; is_won: number | null }>(
    db,
    'SELECT list_id, is_won FROM deals WHERE id = ? AND company_id = ? LIMIT 1',
    [dealId, user.company_id],
  )
  const prevListId = prevRows[0]?.list_id
  const prevIsWon = prevRows[0]?.is_won
  const movedAcross = prevListId !== undefined && prevListId !== data.list_id
  const fromClosed = prevIsWon === 1 || prevIsWon === 0

  let changeIsWon = 0
  let isWonVal: number | null = null
  if (movedAcross && fromClosed) {
    changeIsWon = 1
    isWonVal = null
  }
  const clearLostReason = movedAcross && fromClosed

  await db.execute(
    `UPDATE deals
         SET customer_id = ?, amount = ?, title = ?, list_id = ?, position = ?,
             is_won = IF(? = 1, ?, is_won),
             lost_reason = IF(?, NULL, lost_reason)
       WHERE id = ? AND company_id = ?`,
    [
      data.customer_id,
      data.amount,
      data.title ?? null,
      data.list_id,
      data.position,
      changeIsWon,
      isWonVal,
      clearLostReason ? 1 : 0,
      dealId,
      user.company_id,
    ],
  )

  if (movedAcross) {
    await transitionDealStage(dealId, data.list_id)
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Deal updated successfully'))
  return redirect(`../`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: User

  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }

  const dealId = parseInt(params.dealId, 10)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT d.id, d.customer_id, d.amount, d.title, d.status, d.list_id, d.position, c.name
         FROM deals d
         JOIN customers c ON d.customer_id = c.id
         WHERE d.id = ? AND d.company_id = ? AND d.deleted_at IS NULL`,
    [dealId, user.company_id],
  )
  if (!rows || rows.length === 0) {
    return redirect('/employee/deals')
  }
  const deal: DealsDialogSchema = {
    company_id: user.company_id,
    customer_id: rows[0].customer_id,
    amount: rows[0].amount,
    title: rows[0].title || '',
    status: rows[0].status,
    list_id: rows[0].list_id,
    position: rows[0].position,
    user_id: user.id,
  }
  return { dealId, companyId: user.company_id, deal, user_id: user.id }
}
