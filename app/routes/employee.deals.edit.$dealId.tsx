import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import DealsForm from '~/components/DealsForm'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser } from '~/utils/session.server'
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
  await db.execute(
    `UPDATE deals
     (name, amount, customer_id, description, status, list_id, position, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      data.name,
      data.amount,
      data.customer_id,
      data.description,
      data.status,
      data.list_id,
      data.position,
      data.is_deleted,
    ],
  )
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Sale completed successfully'))
  return redirect(`../`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)
  return { dealId }
}

export default function DealEdit() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)

  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) navigate('..')
  }

  return <DealsForm open={open} onOpenChange={handleOpenChange} />
}
