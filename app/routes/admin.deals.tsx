import { Mail, Menu, SettingsIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import DealsList from '~/components/DealsList'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
import { FindCustomer } from '~/components/molecules/FindCustomer'
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
import { db } from '~/db.server'
import type { Customer } from '~/types'
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
  has_email?: boolean
  has_images?: boolean
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

    // Groups for filter
    const groups = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM groups_list WHERE deleted_at IS NULL AND is_displayed = 1 AND (company_id = ? OR id = 1)',
      [companyId],
    )

    const activeGroupId = viewParam ? parseInt(viewParam, 10) : groups[0]?.id

    // Lists for columns (filtered by active group)
    const lists = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL AND group_id = ? ORDER BY position',
      [activeGroupId],
    )

    const dealParams: (string | number)[] = [companyId]
    let dealSql = `
      SELECT d.id, d.customer_id, d.amount, d.description, d.status, d.lost_reason, d.list_id, d.position, d.due_date, u.name AS sales_rep
      FROM deals d
      JOIN customers c ON d.customer_id = c.id
      JOIN users u ON d.user_id = u.id
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

    // Customers for names
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

    return {
      deals,
      customers,
      lists,
      emailsMap,
      imagesMap,
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
    groups,
    activeGroupId,
    isWon,
  } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

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

  type Deal = {
    id: number
    customer_id: number
    name: string
    company_name?: string | null
    amount?: number | null
    description?: string | null
    status?: string | null
    lost_reason?: string | null
    position?: number
    list_id: number
    due_date?: string | null
    sales_rep?: string | null
    user_id?: number | null
    has_email?: boolean
    has_images?: boolean
  }

  const toDeal = (d: AdminDeal): Deal => {
    const customer = customers.find(c => c.id === d.customer_id)
    return {
      id: d.id,
      customer_id: d.customer_id,
      name: customer ? customer.name : `Customer #${d.customer_id}`,
      company_name: customer?.company_name,
      amount: d.amount,
      description: d.description,
      status: d.status ?? undefined,
      lost_reason: d.lost_reason ?? undefined,
      position: d.position ?? undefined,
      list_id: d.list_id,
      due_date: d.due_date
        ? typeof d.due_date === 'string'
          ? d.due_date
          : new Date(d.due_date).toISOString().slice(0, 10)
        : null,
      sales_rep: d.sales_rep ?? undefined,
      user_id: d.user_id ?? undefined,
      has_email: emailsMap?.[d.id] || false,
      has_images: imagesMap?.[d.id] || false,
    }
  }

  const sortDeals = (arr: Deal[]) => {
    const copy = [...arr]
    copy.sort((a, b) => {
      const aHas = Boolean(a.due_date)
      const bHas = Boolean(b.due_date)
      if (!aHas && !bHas) return 0
      if (!aHas) return -1
      if (!bHas) return 1
      return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()
    })
    return copy
  }

  const initialBoard = useMemo(() => {
    const board: Record<number, Deal[]> = {}
    for (const l of lists) board[l.id] = []
    for (const d of deals) {
      const deal = toDeal(d)
      board[deal.list_id] = board[deal.list_id] || []
      board[deal.list_id].push(deal)
    }
    for (const l of lists) board[l.id] = sortDeals(board[l.id])
    return board
  }, [JSON.stringify(deals), JSON.stringify(customers), JSON.stringify(lists)])

  const [board, setBoard] = useState<Record<number, Deal[]>>(initialBoard)
  const [highlightDealId, setHighlightDealId] = useState<number | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setBoard(initialBoard)
  }, [JSON.stringify(initialBoard)])

  useEffect(() => {
    const highlight = searchParams.get('highlight')
    if (highlight) {
      const dealId = parseInt(highlight, 10)
      if (!Number.isNaN(dealId)) {
        // Clear previous timeout if any
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current)
        }

        // Wait a bit for the DOM to settle
        setTimeout(() => {
          const el = document.getElementById(`deal-${dealId}`)
          if (el) {
            el.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'center',
            })
            setHighlightDealId(dealId)

            highlightTimeoutRef.current = setTimeout(() => {
              setHighlightDealId(null)
              highlightTimeoutRef.current = null
              // Optional: remove highlight param from URL
              const newParams = new URLSearchParams(searchParams)
              newParams.delete('highlight')
              navigate(
                { pathname: location.pathname, search: newParams.toString() },
                { replace: true },
              )
            }, 2010)
          }
        }, 100)
      }
    }
  }, [searchParams, board])

  const findDealIdByCustomer = (
    customerId: number,
    customer?: Customer,
  ): number | undefined => {
    for (const l of lists) {
      const hit = board[l.id]?.find(d => d.customer_id === customerId)
      if (hit) return hit.id
    }
    return customer?.deal_id ?? undefined
  }

  return (
    <div className='w-full'>
      <div className='w-full flex flex-col sm:flex-row justify-between items-center mb-1'>
        <div className='flex items-center gap-2'>
          <div className='hidden md:block'>
            <OriginalSidebarTrigger />
          </div>
          <SalesRepsFilter />
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
        </div>
        <FindCustomer
          className='mt-2 ml-2'
          onEdit={(customerId, customer) => {
            const dealId = findDealIdByCustomer(customerId, customer)
            if (dealId) navigate(`edit/${dealId}/information${location.search}`)
          }}
          onDelete={(customerId, customer) => {
            const dealId = findDealIdByCustomer(customerId, customer)
            if (dealId) navigate(`edit/${dealId}/delete${location.search}`)
          }}
          onSelect={(customerId, customer) => {
            const dealId = findDealIdByCustomer(customerId, customer)
            if (!dealId) return

            const isInBoard = lists.some(l => board[l.id]?.some(d => d.id === dealId))

            if (!isInBoard && customer) {
              const isWonStatus = customer.deal_is_won
              let newStatus = 'null'
              if (isWonStatus === 1) newStatus = '1'
              else if (isWonStatus === 0) newStatus = '0'

              const params = new URLSearchParams(searchParams)
              if (params.get('is_won') !== newStatus) {
                params.set('is_won', newStatus)
                params.set('highlight', String(dealId))
                navigate({ pathname: location.pathname, search: params.toString() })
                return
              }
            }

            if (highlightTimeoutRef.current) {
              clearTimeout(highlightTimeoutRef.current)
            }

            setHighlightDealId(null)

            const el = document.getElementById(`deal-${dealId}`)
            if (el) {
              el.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center',
              })
            }

            setTimeout(() => {
              setHighlightDealId(dealId)
            }, 10)

            highlightTimeoutRef.current = setTimeout(() => {
              setHighlightDealId(null)
              highlightTimeoutRef.current = null
            }, 2010)
          }}
          resolveId={findDealIdByCustomer}
          noActionsLabel='No Deals'
        />
      </div>
      <div className='flex gap-1'>
        {lists.map(list => {
          const listDeals = board[list.id] ?? []

          return (
            <DealsList
              key={list.id}
              title={list.name}
              customers={listDeals}
              id={list.id}
              readonly
              highlightedDealId={highlightDealId ?? undefined}
            />
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
