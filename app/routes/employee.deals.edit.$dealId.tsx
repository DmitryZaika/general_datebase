import { zodResolver } from '@hookform/resolvers/zod'
import type { RowDataPacket } from 'mysql2'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
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

export default function DealsEdit() {
  const navigate = useNavigate()
  const location = useLocation()
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`)
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[500px] overflow-auto flex flex-col justify-baseline min-h-[390px] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>
        <Tabs
          value={location.pathname.split('/').pop()}
          onValueChange={value => navigate(value)}
        >
          <TabsList className='mb-5 grid grid-cols-4'>
            <TabsTrigger value={`project${location.search}`}>Project</TabsTrigger>
            <TabsTrigger value={`information${location.search}`}>General</TabsTrigger>
            <TabsTrigger value={`images${location.search}`}>Images</TabsTrigger>
            <TabsTrigger value={`documents${location.search}`}>Documents</TabsTrigger>
          </TabsList>
          <Outlet />
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
