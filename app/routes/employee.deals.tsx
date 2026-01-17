import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import DealsView from '~/components/views/DealsView'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions.server'
import type { Company } from '~/types/company'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

type FullDeal = DealsDialogSchema & {
  id: number
  user_id: number
  due_date: string | null
  customer_id: number
  lost_reason: string | null
}

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

  const { errors } = await getValidatedFormData(request, resolver)

  if (errors) {
    return { errors }
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'List added successfully'))
  return redirect('.', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)

    const url = new URL(request.url)
    const viewParam = url.searchParams.get('view')
    // Removed view type logic as we are only showing groups now

    const groups = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM groups_list WHERE deleted_at IS NULL AND is_displayed = 1 AND (company_id = ? OR id = 1)',
      [user.company_id],
    )
    
    // Default to the first group if no view param or invalid
    const activeGroupId = viewParam ? parseInt(viewParam, 10) : groups[0]?.id
    
    // Fetch lists for the active group
    const lists = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL AND group_id = ? ORDER BY position',
      [activeGroupId]
    )

    const deals = await selectMany<FullDeal>(
      db,
      `SELECT id, customer_id, amount, description, status, lost_reason, list_id, position,
       DATE_FORMAT(due_date, '%Y-%m-%d') as due_date, deleted_at
       FROM deals
       WHERE deleted_at IS NULL AND user_id = ?`,
      [user.id],
    )
    const imagesCounts = await selectMany<{ deal_id: number; count: number }>(
      db,
      'SELECT deal_id, COUNT(*) as count FROM deals_images GROUP BY deal_id',
    )
    const imagesMap: Record<number, boolean> = {}
    for (const row of imagesCounts) imagesMap[row.deal_id] = Number(row.count) > 0
    const emailCounts = await selectMany<{ deal_id: number; count: number }>(
      db,
      'SELECT deal_id, COUNT(*) as count FROM emails WHERE deleted_at IS NULL AND deal_id IS NOT NULL GROUP BY deal_id',
    )
    const emailsMap: Record<number, boolean> = {}
    for (const row of emailCounts) emailsMap[row.deal_id] = Number(row.count) > 0

    const customers = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM customers WHERE company_id = ? AND deleted_at IS NULL',
      [user.company_id],
    )
    
    let companies: Company[] = []

    return { deals, customers, lists, imagesMap, emailsMap, companies, groups, activeGroupId }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function EmployeeDeals() {
  const { deals, customers, lists, imagesMap, emailsMap, companies, groups, activeGroupId } =
    useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const handleGroupChange = (newGroupId: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', newGroupId)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const viewSelect = (
    <Select value={String(activeGroupId)} onValueChange={handleGroupChange}>
      <SelectTrigger className='w-[200px]'>
        <SelectValue placeholder='Select group' />
      </SelectTrigger>
      <SelectContent>
        {groups.map(group => (
            <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <>
        <DealsView
          deals={deals}
          customers={customers}
          lists={lists}
          imagesMap={imagesMap}
          emailsMap={emailsMap}
          viewSelect={viewSelect}
        />

      <Outlet />
    </>
  )
}
