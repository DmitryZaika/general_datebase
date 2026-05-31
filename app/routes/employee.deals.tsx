import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
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
import { DealsBoardShell } from '~/components/views/DealsBoardShell'
import DealsView from '~/components/views/DealsView'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import {
  emptyDealsBoardMaps,
  loadDealsBoardMaps,
} from '~/utils/dealsBoardLoader.server'
import { dealsLayoutShouldRevalidate } from '~/utils/dealsLayoutShouldRevalidate'
import { EMPLOYEE_VIEW_ENTER } from '~/utils/employeeViewEnterMotion'
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
    const parsedView = viewParam ? parseInt(viewParam, 10) : Number.NaN
    const activeGroupId = groups.find(g => g.id === parsedView)?.id ?? groups[0]?.id

    if (!activeGroupId && groups.length > 0) {
      // Handle case where activeGroupId might be NaN or 0 if that's not intended
    }

    const isWonParam = url.searchParams.get('is_won')
    const isWon =
      isWonParam === 'null' || isWonParam === null
        ? null
        : isWonParam === '1'
          ? 1
          : isWonParam === '0'
            ? 0
            : null

    const lists = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL AND group_id = ? ORDER BY position',
      [activeGroupId],
    )

    const listIds = lists.map(l => l.id)
    if (listIds.length === 0) {
      const customers = await selectMany<{
        id: number
        name: string
        company_name?: string
      }>(
        db,
        'SELECT id, name, company_name FROM customers WHERE company_id = ? AND deleted_at IS NULL',
        [user.company_id],
      )
      const emptyMaps = emptyDealsBoardMaps()
      return {
        deals: [],
        customers,
        lists,
        ...emptyMaps,
        groups,
        activeGroupId,
        isWon,
      }
    }

    const listIn = listIds.map(() => '?').join(', ')
    let deals: FullDeal[]

    if (isWon === null) {
      deals = await selectMany<FullDeal>(
        db,
        `SELECT id, customer_id, amount, title, status, lost_reason, list_id, position,
         DATE_FORMAT(due_date, '%Y-%m-%d') as due_date, deleted_at, is_won
         FROM deals
         WHERE deleted_at IS NULL AND user_id = ? AND is_won IS NULL AND list_id IN (${listIn})`,
        [user.id, ...listIds],
      )
    } else {
      deals = await selectMany<FullDeal>(
        db,
        `SELECT id, customer_id, amount, title, status, lost_reason, list_id, position,
         DATE_FORMAT(due_date, '%Y-%m-%d') as due_date, deleted_at, is_won
         FROM deals
         WHERE deleted_at IS NULL AND user_id = ? AND is_won = ? AND list_id IN (${listIn})`,
        [user.id, isWon, ...listIds],
      )
    }

    const dealIds = deals.map(d => d.id)
    const {
      imagesMap,
      emailsMap,
      nearestActivityMap,
      activitiesMap,
      activitiesIconMap,
      notesMap,
    } = await loadDealsBoardMaps(db, dealIds, user.company_id)

    const customers = await selectMany<{
      id: number
      name: string
      company_name?: string
    }>(
      db,
      'SELECT id, name, company_name FROM customers WHERE company_id = ? AND deleted_at IS NULL',
      [user.company_id],
    )

    return {
      deals,
      customers,
      lists,
      imagesMap,
      emailsMap,
      nearestActivityMap,
      activitiesMap,
      activitiesIconMap,
      notesMap,
      groups,
      activeGroupId,
      isWon,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  return dealsLayoutShouldRevalidate('/employee/deals', args)
}

export default function EmployeeDeals() {
  const {
    deals,
    customers,
    lists,
    imagesMap,
    emailsMap,
    nearestActivityMap,
    activitiesMap,
    activitiesIconMap,
    notesMap,
    groups,
    activeGroupId,
    isWon,
  } = useLoaderData<{
    deals: FullDeal[]
    customers: { id: number; name: string }[]
    lists: { id: number; name: string }[]
    imagesMap: Record<number, boolean>
    emailsMap: Record<number, boolean>
    nearestActivityMap: Record<
      number,
      { id: number; name: string; deadline: string | null; priority: string }
    >
    activitiesMap: Record<number, boolean>
    activitiesIconMap: Record<number, 'red' | 'yellow' | 'gray'>
    notesMap: Record<number, boolean>
    groups: { id: number; name: string }[]
    activeGroupId: number | undefined
    isWon: number | null
  }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const revalidator = useRevalidator()

  useEffect(() => {
    const state = location.state as { shouldRevalidate?: boolean } | null
    if (state?.shouldRevalidate) {
      revalidator.revalidate()
      navigate(location.pathname + location.search, { replace: true, state: {} })
    }
  }, [location.state])

  const handleGroupChange = (newGroupId: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', newGroupId)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('is_won', newStatus)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const groupSelect = (
    <Select
      value={activeGroupId ? String(activeGroupId) : ''}
      onValueChange={handleGroupChange}
    >
      <SelectTrigger className='w-[150px]'>
        <SelectValue placeholder='Select group' />
      </SelectTrigger>
      <SelectContent>
        {groups.map(group => (
          <SelectItem key={group.id} value={String(group.id)}>
            {group.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const statusSelect = (
    <Select
      value={isWon === null ? 'null' : String(isWon)}
      onValueChange={handleStatusChange}
    >
      <SelectTrigger className='w-[150px]'>
        <SelectValue placeholder='Select status' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='null'>Active Deals</SelectItem>
        <SelectItem value='1'>Won</SelectItem>
        <SelectItem value='0'>Lost</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <motion.div className='w-full' {...EMPLOYEE_VIEW_ENTER}>
      <DealsBoardShell dealsBasePath='/employee/deals'>
        <DealsView
          deals={deals}
          customers={customers}
          lists={lists}
          imagesMap={imagesMap}
          emailsMap={emailsMap}
          nearestActivityMap={nearestActivityMap}
          activitiesMap={activitiesMap}
          activitiesIconMap={activitiesIconMap}
          notesMap={notesMap}
          groupListSelect={
            <div className='flex gap-2 '>
              {groupSelect}
              {statusSelect}
            </div>
          }
        />
      </DealsBoardShell>
    </motion.div>
  )
}
