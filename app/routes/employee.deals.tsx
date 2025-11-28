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
import PartnersTable from '~/components/PartnersTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import DealsView from '~/components/views/DealsView'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions.server'
import type { Partner } from '~/types/partner'
import { ViewType } from '~/types/viewType'
import { csrf } from '~/utils/csrf.server'
import { getPartnersForUser } from '~/utils/partnerQueries'
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

  const { errors } = await getValidatedFormData<DealsDialogSchema>(request, resolver)

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
    const view = (viewParam === ViewType.PARTNERS ? ViewType.PARTNERS : ViewType.DEALS) as ViewType

    const lists = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL ORDER BY position',
    )
    const deals = await selectMany<FullDeal>(
      db,
      `SELECT id, customer_id, amount, description, status, lost_reason, list_id, position, due_date, deleted_at
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
    const customers = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM customers WHERE company_id = ? AND deleted_at IS NULL',
      [user.company_id],
    )

    let partners: Partner[] = []
    if (view === ViewType.PARTNERS) {
      partners = await selectMany<Partner>(
        db,
        getPartnersForUser(user.id),
        [user.id]
      )
    }

    return { deals, customers, lists, imagesMap, partners, view }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function EmployeeDeals() {
  const { deals, customers, lists, imagesMap, partners, view } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const handleViewChange = (newView: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', newView)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const viewSelect = (
    <Select value={view} onValueChange={handleViewChange}>
      <SelectTrigger className='w-[200px]'>
        <SelectValue placeholder='Select view' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ViewType.DEALS}>Deals</SelectItem>
        <SelectItem value={ViewType.PARTNERS}>Partners</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <>
      {view === ViewType.PARTNERS ? (
        <>
          <div className='w-full flex justify-between items-center mb-4'>
            {viewSelect}
          </div>
          <PartnersTable partners={partners} />
        </>
      ) : (
        <DealsView
          deals={deals}
          customers={customers}
          lists={lists}
          imagesMap={imagesMap}
          viewSelect={viewSelect}
        />
      )}

      <Outlet />
    </>
  )
}
