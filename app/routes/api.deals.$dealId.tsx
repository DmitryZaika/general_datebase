import { zodResolver } from "@hookform/resolvers/zod"
import { RowDataPacket } from "mysql2"
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router"
import { getValidatedFormData } from "remix-hook-form"
import { db } from "~/db.server"
import { selectMany } from "~/utils/queryHelpers"
import { DealsDialogSchema, dealsSchema } from "~/schemas/deals"
import { commitSession, getSession } from "~/sessions.server"
import { csrf } from "~/utils/csrf.server"
import { getEmployeeUser, User } from "~/utils/session.server"
import { toastData } from "~/utils/toastHelpers.server"

export async function action({ request }: ActionFunctionArgs) {
    try {
      await getEmployeeUser(request)
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
    const url = new URL(request.url)
    const dealId = Number(url.pathname.split('/').pop())
  
    const prevRows = await selectMany<{ list_id: number }>(
      db,
      'SELECT list_id FROM deals WHERE id = ? LIMIT 1',
      [dealId],
    )
    const prevListId = prevRows[0]?.list_id

    await db.execute(
      `UPDATE deals
         SET customer_id = ?, amount = ?, description = ?, list_id = ?, position = ?,
             due_date = IF(? IN (4,5), NULL, due_date)
       WHERE id = ?`,
      [
        data.customer_id,
        data.amount,
        data.description,
        data.list_id,
        data.position,
        data.list_id,
        dealId,
      ],
    )

    if (prevListId !== undefined && prevListId !== data.list_id) {
      await db.execute(
        'UPDATE deal_stage_history SET exited_at = NOW() WHERE deal_id = ? AND exited_at IS NULL',
        [dealId],
      )
      await db.execute(
        'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
        [dealId, data.list_id],
      )
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
      `SELECT d.id, d.customer_id, d.amount, d.description, d.status, d.list_id, d.position, c.name
         FROM deals d
         JOIN customers c ON d.customer_id = c.id
         WHERE d.id = ? AND d.deleted_at IS NULL`,
      [dealId],
    )
    if (!rows || rows.length === 0) {
      return redirect('/employee/deals')
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