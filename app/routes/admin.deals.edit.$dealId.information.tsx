import { zodResolver } from '@hookform/resolvers/zod'
import type { RowDataPacket } from 'mysql2'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import DealsForm from '~/components/DealsForm'
import { transitionDealStage } from '~/crud/deals'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions.server'
import {
  CLOSED_LOST_LIST_ID,
  CLOSED_WON_LIST_ID,
  TERMINAL_LIST_IDS,
} from '~/utils/constants'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
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
  const dealId = parseInt(params.dealId || '', 10)
  if (Number.isNaN(dealId)) {
    return { error: 'Invalid deal id' }
  }

  const prevRows = await selectMany<{ list_id: number }>(
    db,
    'SELECT list_id FROM deals WHERE id = ? LIMIT 1',
    [dealId],
  )
  const prevListId = prevRows[0]?.list_id
  const movedAcross = prevListId !== undefined && prevListId !== data.list_id
  const fromTerminal =
    prevListId !== undefined && TERMINAL_LIST_IDS.includes(prevListId)

  let changeIsWon = 0
  let isWonVal: number | null = null
  if (movedAcross) {
    if (data.list_id === CLOSED_WON_LIST_ID) {
      changeIsWon = 1
      isWonVal = 1
    } else if (data.list_id === CLOSED_LOST_LIST_ID) {
      changeIsWon = 1
      isWonVal = 0
    } else if (fromTerminal) {
      changeIsWon = 1
      isWonVal = null
    }
  }
  const clearLostReason =
    movedAcross && (data.list_id === CLOSED_WON_LIST_ID || fromTerminal)

  await db.execute(
    `UPDATE deals
       SET customer_id = ?, amount = ?, description = ?, list_id = ?, position = ?,
           due_date = IF(? IN (?, ?), NULL, due_date),
           is_won = IF(? = 1, ?, is_won),
           lost_reason = IF(?, NULL, lost_reason)
     WHERE id = ?`,
    [
      data.customer_id,
      data.amount,
      data.description,
      data.list_id,
      data.position,
      data.list_id,
      CLOSED_WON_LIST_ID,
      CLOSED_LOST_LIST_ID,
      changeIsWon,
      isWonVal,
      clearLostReason ? 1 : 0,
      dealId,
    ],
  )

  if (movedAcross) {
    await transitionDealStage(dealId, data.list_id)
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Deal updated successfully'))
  const url = new URL(request.url)
  return redirect(`/admin/deals${url.search}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user: User

  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }

  const dealId = parseInt(params.dealId, 10)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT d.id, d.customer_id, d.amount, d.description, d.status, d.list_id, d.position, c.name
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
    [dealId],
  )
  if (!rows || rows.length === 0) {
    return redirect('/admin/deals')
  }
  const deal: DealsDialogSchema = {
    company_id: user.company_id,
    customer_id: rows[0].customer_id,
    amount: rows[0].amount,
    description: rows[0].description || '',
    status: rows[0].status,
    list_id: rows[0].list_id,
    position: rows[0].position,
    user_id: user.id,
  }
  return { dealId, companyId: user.company_id, deal, user_id: user.id }
}

export default function DealEditInformation() {
  const { companyId, user_id, deal, dealId } = useLoaderData<typeof loader>()

  return (
    <DealsForm companyId={companyId} user_id={user_id} initial={deal} dealId={dealId} />
  )
}
