import { zodResolver } from '@hookform/resolvers/zod'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import DealsForm from '~/components/DealsForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

export async function action({ request }: ActionFunctionArgs) {
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

  const listRows = await selectMany<{ name: string }>(
    db,
    'SELECT name FROM deals_list WHERE id = ? LIMIT 1',
    [data.list_id],
  )
  const initialStatus = listRows[0]?.name || 'New Customer'
  if (!data.deal_id) {
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO deals
     (customer_id, amount, description, status, list_id, position, user_id, is_won)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        data.customer_id,
        data.amount,
        data.description,
        initialStatus,
        data.list_id,
        data.position,
        user.id,
        data.is_won ?? null,
      ],
    )
    await db.execute(
      'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
      [result.insertId, data.list_id],
    )
  } else {
    await db.execute(`UPDATE deals SET amount = ?, description = ? WHERE id = ?`, [
      data.amount,
      data.description,
      data.deal_id,
    ])
  }

  const [positionRows] = await db.execute<RowDataPacket[]>(
    `SELECT 1 FROM users_positions up
     JOIN positions p ON up.position_id = p.id
     WHERE up.user_id = ? AND p.name = 'sales_rep'
     LIMIT 1`,
    [user.id],
  )
  if (positionRows.length > 0) {
    await db.execute(`UPDATE customers SET sales_rep = ? WHERE id = ?`, [
      user.id,
      data.customer_id,
    ])
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Deal added successfully'))
  const url = new URL(request.url)
  return redirect(`../${url.search}`, {
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
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { companyId, user_id } = useLoaderData<typeof loader>()
  const handleClose = (o: boolean) => {
    if (!o) navigate(`..${location.search}`)
  }

  const isWonParam = searchParams.get('is_won')
  const isWon = isWonParam === '1' ? 1 : isWonParam === '0' ? 0 : null
  const listIdParam = parseInt(searchParams.get('list_id') || '', 10)

  const hiddenFields: Record<string, string | number | boolean> = {
    status: 'New Customer',
    position: 1,
    company_id: companyId,
  }
  if (isWon !== null) {
    hiddenFields.is_won = isWon
  }
  if (!Number.isNaN(listIdParam)) {
    hiddenFields.list_id = listIdParam
  }

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Deal</DialogTitle>
        </DialogHeader>

        <DealsForm
          companyId={companyId}
          user_id={user_id}
          hiddenFields={hiddenFields}
        />
      </DialogContent>
      <Outlet />
    </Dialog>
  )
}
