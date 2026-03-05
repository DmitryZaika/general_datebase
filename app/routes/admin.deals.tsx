import { useEffect } from 'react'
import { Mail, Menu, SettingsIcon } from 'lucide-react'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from 'react-router'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
import { SalesRepsFilter } from '~/components/molecules/SalesRepsFilter'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { OriginalSidebarTrigger } from '~/components/ui/sidebar'
import DealsView from '~/components/views/DealsView'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'

type AdminDeal = {
  id: number
  customer_id: number
  amount: number | null
  description: string | null
  status: string | null
  lost_reason: string | null
  list_id: number
  position: number | null
  due_date: string | null
  sales_rep: string | null
  user_id: number | null
  is_won: number | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user: User = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const companyId = user.company_id
    const url = new URL(request.url)
    const salesRep = url.searchParams.get('salesRep') || 'All'
    const viewParam = url.searchParams.get('group')

    const isWonParam = url.searchParams.get('is_won')
    const isWon =
      isWonParam === 'null'
        ? null
        : isWonParam === '1'
          ? 1
          : isWonParam === '0'
            ? 0
            : null

    const groups = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM groups_list WHERE deleted_at IS NULL AND is_displayed = 1 AND (company_id = ? OR id = 1)',
      [companyId],
    )

    const activeGroupId = viewParam ? parseInt(viewParam, 10) : groups[0]?.id

    const lists = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL AND group_id = ? ORDER BY position',
      [activeGroupId],
    )

    const dealParams: (string | number)[] = [companyId]
    let dealSql = `
      SELECT d.id, d.customer_id, d.amount, d.description, d.status, d.lost_reason, d.list_id, d.position, DATE_FORMAT(d.due_date, '%Y-%m-%d') AS due_date, d.is_won, u.name AS sales_rep
      FROM deals d
      JOIN customers c ON d.customer_id = c.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE c.company_id = ? AND d.deleted_at IS NULL
    `
    if (salesRep && salesRep !== 'All') {
      dealSql += ' AND u.name = ?'
      dealParams.push(salesRep)
    }

    if (isWon === null) {
      dealSql += ' AND d.is_won IS NULL'
    } else {
      dealSql += ' AND d.is_won = ?'
      dealParams.push(isWon)
    }

    const deals = await selectMany<AdminDeal>(db, dealSql, dealParams)

    const customers = await selectMany<{
      id: number
      name: string
      company_name?: string
    }>(
      db,
      'SELECT id, name, company_name FROM customers WHERE company_id = ? AND deleted_at IS NULL',
      [companyId],
    )

    const emailCounts = await selectMany<{ deal_id: number; count: number }>(
      db,
      'SELECT deal_id, COUNT(*) as count FROM emails WHERE deleted_at IS NULL AND deal_id IS NOT NULL GROUP BY deal_id',
    )
    const emailsMap: Record<number, boolean> = {}
    for (const row of emailCounts) emailsMap[row.deal_id] = Number(row.count) > 0

    const imagesCounts = await selectMany<{ deal_id: number; count: number }>(
      db,
      'SELECT deal_id, COUNT(*) as count FROM deals_images GROUP BY deal_id',
    )
    const imagesMap: Record<number, boolean> = {}
    for (const row of imagesCounts) imagesMap[row.deal_id] = Number(row.count) > 0

    const nearestActivities = await selectMany<{
      deal_id: number
      name: string
      deadline: string | null
    }>(
      db,
      `SELECT deal_id, name, DATE_FORMAT(deadline, '%Y-%m-%dT%H:%i:%s') AS deadline
       FROM deal_activities
       WHERE deleted_at IS NULL AND is_completed = 0 AND company_id = ?
       ORDER BY
         CASE WHEN deadline IS NULL THEN 1 ELSE 0 END,
         deadline ASC,
         CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
         created_at ASC`,
      [companyId],
    )
    const nearestActivityMap: Record<number, { name: string; deadline: string | null }> = {}
    for (const a of nearestActivities) {
      if (!nearestActivityMap[a.deal_id]) {
        nearestActivityMap[a.deal_id] = { name: a.name, deadline: a.deadline }
      }
    }

    return {
      deals,
      customers,
      lists,
      emailsMap,
      imagesMap,
      nearestActivityMap,
      groups,
      activeGroupId,
      isWon,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function AdminDeals() {
  const {
    deals,
    customers,
    lists,
    emailsMap,
    imagesMap,
    nearestActivityMap,
    groups,
    activeGroupId,
    isWon,
  } = useLoaderData<typeof loader>()
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
    params.set('group', newGroupId)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('is_won', newStatus)
    navigate({ pathname: location.pathname, search: params.toString() })
  }

  const normalizedDeals = deals.map(d => ({
    ...d,
    position: d.position ?? undefined,
  }))

  return (
    <div className='w-full'>
      <DealsView
        deals={normalizedDeals}
        customers={customers}
        lists={lists}
        imagesMap={imagesMap}
        emailsMap={emailsMap}
        nearestActivityMap={nearestActivityMap}
        readonly
        showAddDeal={false}
        toolbarLeft={
          <>
            <div className='hidden md:block'>
              <OriginalSidebarTrigger />
            </div>
            <SalesRepsFilter />
          </>
        }
        groupListSelect={
          <>
            <Select value={String(activeGroupId)} onValueChange={handleGroupChange}>
              <SelectTrigger className='w-[150px] mt-2'>
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
            <CustomDropdownMenu
              selectedList={
                isWon === null ? 'Active Deals' : isWon === 1 ? 'Won' : 'Lost'
              }
              trigger={
                <Button variant='outline' className='mt-2'>
                  <Menu className='w-4 h-4 mr-2' />
                  <span className='select-none'>Menu</span>
                </Button>
              }
              sections={[
                {
                  title: 'Status Filter',
                  options: [
                    {
                      label: 'Active Deals',
                      onClick: () => handleStatusChange('null'),
                      className: isWon === null ? 'bg-accent' : '',
                    },
                    {
                      label: 'Won',
                      onClick: () => handleStatusChange('1'),
                      className: isWon === 1 ? 'bg-accent' : '',
                    },
                    {
                      label: 'Lost',
                      onClick: () => handleStatusChange('0'),
                      className: isWon === 0 ? 'bg-accent' : '',
                    },
                  ],
                },
                {
                  title: 'Management',
                  options: [
                    {
                      label: 'Manage Email Templates',
                      icon: <Mail className='w-4 h-4' />,
                      onClick: () => navigate(`email-templates${location.search}`),
                    },
                    {
                      label: 'Manage Lists',
                      icon: <SettingsIcon className='w-4 h-4' />,
                      onClick: () => navigate(`manage-lists${location.search}`),
                    },
                  ],
                },
              ]}
            />
          </>
        }
      />
      <Outlet />
    </div>
  )
}
