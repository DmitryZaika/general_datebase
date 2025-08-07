import { zodResolver } from '@hookform/resolvers/zod'
import type { RowDataPacket } from 'mysql2'
import { useState } from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import DealsForm from '~/components/DealsForm'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions'

import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

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

  const { errors, data, receivedValues } =
    await getValidatedFormData<DealsDialogSchema>(request, resolver)
  if (errors) {
    return { errors, receivedValues }
  }
  const url = new URL(request.url)
  const dealId = Number(url.pathname.split('/').pop())

  await db.execute(
    `UPDATE deals
       SET customer_id = ?, amount = ?, description = ?, list_id = ?, position = ?
     WHERE id = ?`,
    [
      data.customer_id,
      data.amount,
      data.description,
      data.list_id,
      data.position,
      dealId,
    ],
  )
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Sale completed successfully'))
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

export default function DealEdit() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const { companyId, dealId, deal, user_id } = useLoaderData<typeof loader>()
  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) navigate('..')
  }

  return (
    <DealsForm
      open={open}
      onOpenChange={handleOpenChange}
      companyId={companyId}
      dealId={dealId}
      initial={deal}
      user_id={user_id}
    />
  )
}
