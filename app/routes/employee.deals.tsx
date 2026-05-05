import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
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
import DealsView from '~/components/views/DealsView'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions.server'
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

    let deals: FullDeal[]

    if (isWon === null) {
      deals = await selectMany<FullDeal>(
        db,
        `SELECT id, customer_id, amount, title, status, lost_reason, list_id, position,
         DATE_FORMAT(due_date, '%Y-%m-%d') as due_date, deleted_at, is_won
         FROM deals
         WHERE deleted_at IS NULL AND user_id = ? AND is_won IS NULL`,
        [user.id],
      )
    } else {
      deals = await selectMany<FullDeal>(
        db,
        `SELECT d.id, d.customer_id, d.amount, d.title, d.status, d.lost_reason,
         d.list_id,
         d.position, DATE_FORMAT(d.due_date, '%Y-%m-%d') as due_date, d.deleted_at, d.is_won
         FROM deals d
         WHERE d.deleted_at IS NULL AND d.user_id = ? AND d.is_won = ?`,
        [user.id, isWon],
      )
    }
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

    const nearestActivities = await selectMany<{
      id: number
      deal_id: number
      name: string
      deadline: string | null
      priority: string
    }>(
      db,
      `SELECT id, deal_id, name, priority, DATE_FORMAT(deadline, '%Y-%m-%dT%H:%i:%sZ') AS deadline
       FROM deal_activities
       WHERE deleted_at IS NULL AND is_completed = 0 AND company_id = ?
       ORDER BY
         CASE WHEN deadline IS NULL THEN 1 ELSE 0 END,
         deadline ASC,
         CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
         created_at ASC`,
      [user.company_id],
    )
    const nearestActivityMap: Record<
      number,
      { id: number; name: string; deadline: string | null; priority: string }
    > = {}
    for (const a of nearestActivities) {
      if (!nearestActivityMap[a.deal_id]) {
        nearestActivityMap[a.deal_id] = {
          id: a.id,
          name: a.name,
          deadline: a.deadline,
          priority: a.priority,
        }
      }
    }

    const activitiesCounts = await selectMany<{ deal_id: number; count: number }>(
      db,
      `SELECT deal_id, COUNT(*) as count FROM deal_activities WHERE company_id = ? AND deleted_at IS NULL AND is_completed = 0 GROUP BY deal_id`,
      [user.company_id],
    )
    const activitiesMap: Record<number, boolean> = {}
    for (const row of activitiesCounts)
      activitiesMap[row.deal_id] = Number(row.count) > 1

    const activitiesDeadlines = await selectMany<{
      deal_id: number
      deadline: string | null
    }>(
      db,
      `SELECT deal_id, deadline FROM deal_activities WHERE company_id = ? AND deleted_at IS NULL AND is_completed = 0`,
      [user.company_id],
    )
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const activitiesIconMap: Record<number, 'red' | 'yellow' | 'gray'> = {}
    for (const row of activitiesDeadlines) {
      const current = activitiesIconMap[row.deal_id]
      if (current === 'red') continue
      const d = row.deadline ? new Date(row.deadline) : null
      if (!d || Number.isNaN(d.getTime())) {
        if (current === undefined) activitiesIconMap[row.deal_id] = 'gray'
        continue
      }
      const deadlineDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      if (deadlineDate.getTime() < today.getTime()) {
        activitiesIconMap[row.deal_id] = 'red'
      } else if (deadlineDate.getTime() === today.getTime()) {
        activitiesIconMap[row.deal_id] = 'yellow'
      } else if (current === undefined) {
        activitiesIconMap[row.deal_id] = 'gray'
      }
    }

    const notesCounts = await selectMany<{ deal_id: number; count: number }>(
      db,
      `SELECT deal_id, COUNT(*) as count FROM deal_notes WHERE company_id = ? AND deleted_at IS NULL GROUP BY deal_id`,
      [user.company_id],
    )
    const notesMap: Record<number, boolean> = {}
    for (const row of notesCounts) notesMap[row.deal_id] = Number(row.count) >= 1

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
    <>
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

      <Outlet />
    </>
  )
}
