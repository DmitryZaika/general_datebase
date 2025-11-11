import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import DealsList from '~/components/DealsList'
import { FindCustomer } from '~/components/molecules/FindCustomer'
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
    const lists = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL ORDER BY position',
    )
    const deals = await selectMany<FullDeal>(
      db,
      `SELECT id, customer_id, amount, description, status, list_id, position, due_date, deleted_at
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
    return { deals, customers, lists, imagesMap }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function EmployeeDeals() {
  const { deals, customers, lists, imagesMap } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()

  type Deal = {
    id: number
    customer_id: number
    name: string
    amount?: number | null
    description?: string | null
    status?: string | null
    position?: number
    list_id: number
    due_date?: string | null
    has_images?: boolean
  }

  const toDeal = (d: FullDeal): Deal => {
    const customer = customers.find(c => c.id === d.customer_id)
    return {
      id: d.id,
      customer_id: d.customer_id,
      name: customer ? customer.name : `Customer #${d.customer_id}`,
      amount: d.amount,
      description: d.description,
      status: d.status ?? undefined,
      position: d.position ?? undefined,
      list_id: d.list_id,
      due_date: d.due_date
        ? typeof d.due_date === 'string'
          ? d.due_date
          : new Date(d.due_date).toISOString().slice(0, 10)
        : null,
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
  const [activeId, setActiveId] = useState<number | null>(null)
  const [highlightDealId, setHighlightDealId] = useState<number | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => setBoard(initialBoard), [JSON.stringify(initialBoard)])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  )

  const findContainerOfDeal = (dealId: number): number | undefined => {
    for (const l of lists) {
      if (board[l.id]?.some(d => d.id === dealId)) return l.id
    }
    return undefined
  }

  const findDeal = (dealId: number): Deal | undefined => {
    for (const l of lists) {
      const hit = board[l.id]?.find(d => d.id === dealId)
      if (hit) return hit
    }
    return undefined
  }

  const findDealIdByCustomer = (customerId: number): number | undefined => {
    for (const l of lists) {
      const hit = board[l.id]?.find(d => d.customer_id === customerId)
      if (hit) return hit.id
    }
    return undefined
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id)
    setActiveId(id)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = Number(active.id)
    let toListId: number | undefined
    const overData = over.data?.current
    if (overData?.type === 'list') {
      toListId = Number(overData.listId)
    } else if (overData?.type === 'deal' && overData.listId !== undefined) {
      toListId = Number(overData.listId)
    } else {
      const overKey = String(over.id)
      if (overKey.startsWith('list-')) {
        const parsed = Number(overKey.replace('list-', ''))
        toListId = Number.isFinite(parsed) ? parsed : undefined
      } else {
        const overId = Number(over.id)
        toListId = board[overId] !== undefined ? overId : findContainerOfDeal(overId)
      }
    }

    const fromListId = findContainerOfDeal(activeId)
    if (fromListId === undefined || toListId === undefined) return

    if (fromListId === toListId) return

    setBoard(prev => {
      const copy = { ...prev }
      const fromArr = [...(copy[fromListId] || [])]
      const toArr = [...(copy[toListId] || [])]
      const idx = fromArr.findIndex(d => d.id === activeId)
      if (idx === -1) return prev
      const shouldClearDate = toListId === 4 || toListId === 5
      const moved = {
        ...fromArr[idx],
        list_id: toListId,
        due_date: shouldClearDate ? null : fromArr[idx].due_date,
      }
      fromArr.splice(idx, 1)
      toArr.push(moved)
      copy[fromListId] = sortDeals(fromArr)
      copy[toListId] = sortDeals(toArr)
      return copy
    })

    await fetch('/api/deals/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [{ id: activeId, list_id: toListId, position: 0 }],
      }),
    })
    setActiveId(null)

    if (toListId === 5) {
      const fromPos = findDeal(activeId)?.position ?? 0
      navigate(
        `reason?dealId=${activeId}&fromListId=${fromListId}&fromPos=${fromPos}${location.search}`,
      )
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={args => {
        const pointerCollisions = pointerWithin(args)
        if (pointerCollisions.length > 0) return pointerCollisions
        return closestCorners(args)
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className='w-full flex justify-end mb-2'>
        <FindCustomer
          disableRowClick
          onEdit={customerId => {
            const dealId = findDealIdByCustomer(customerId)
            if (dealId) navigate(`edit/${dealId}/information${location.search}`)
          }}
          onDelete={customerId => {
            const dealId = findDealIdByCustomer(customerId)
            if (dealId) navigate(`edit/${dealId}/delete`)
          }}
          onSelect={customerId => {
            const dealId = findDealIdByCustomer(customerId)
            if (!dealId) return

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
      <div className='flex  gap-4'>
        {lists.map(list => (
          <DealsList
            key={list.id}
            title={list.name}
            customers={board[list.id] ?? []}
            id={list.id}
            highlightedDealId={highlightDealId ?? undefined}
          />
        ))}
        <Outlet />
      </div>
      <DragOverlay>
        {activeId !== null
          ? (() => {
              const d = findDeal(activeId)
              if (!d) return null
              return (
                <div className='w-72 border rounded-lg p-2 shadow-md bg-white'>
                  <div className='text-lg font-semibold truncate'>{d.name}</div>
                  <div className='text-xs text-slate-500 mt-1'>
                    Amount: $ {d.amount ?? 0}
                  </div>
                  {d.due_date && (
                    <div className='text-xs text-slate-500 mt-1'>
                      {new Date(d.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )
            })()
          : null}
      </DragOverlay>
      <Outlet />
    </DndContext>
  )
}
