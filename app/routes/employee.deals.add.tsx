import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { DealsForm } from '~/components/DealsForm'
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

  await db.execute(
    `INSERT INTO deals
     (customer_id, amount, description, status, list_id, position, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      data.customer_id,
      data.amount,
      data.description,
      data.status,
      data.list_id,
      data.position,
      data.user_id,
    ],
  )

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Deal added successfully'))
  return redirect(`../`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const user_id = user.id
  return { companyId: user.company_id, user_id }
}

export default function AddDeal() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(true)
  const { companyId, user_id } = useLoaderData<typeof loader>()
  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) navigate('..')
  }

  const listIdParam = parseInt(searchParams.get('list_id') || '', 10)
  const hiddenFields: Record<string, string | number | boolean> = {
    status: 'new',
    position: 1,
    company_id: companyId,
  }
  if (!Number.isNaN(listIdParam)) {
    hiddenFields.list_id = listIdParam
  }

  return (
    <DealsForm
      companyId={companyId}
      user_id={user_id}
      open={open}
      onOpenChange={handleOpenChange}
      hiddenFields={hiddenFields}
    />
  )
}
