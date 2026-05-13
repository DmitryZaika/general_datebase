import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { motion, type Variants } from 'framer-motion'
import { MoreVertical, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import DealsList from '~/components/DealsList'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
import { FindCustomer } from '~/components/molecules/FindCustomer'
import { Button } from '~/components/ui/button'
import { isDateOnlyDeadline, localCalendarDate } from '~/lib/dateHelpers'
import type { Customer } from '~/types'
import type { DealCardData } from '~/types/deals'
import type { Nullable } from '~/types/utils'

const DEALS_BOARD_LIST_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.06,
    },
  },
}

const DEALS_BOARD_COLUMN_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30, mass: 0.75 },
  },
}

const DEALS_TOOLBAR_MOTION = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: [0.2, 0.78, 0.22, 1] as const },
}

const DEALS_SHELL_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.2, 0.78, 0.22, 1] as const },
}

function compareNearestActivityDeadlines(aDate: string, bDate: string): number {
  const localA = localCalendarDate(aDate)
  const localB = localCalendarDate(bDate)
  const dayA = new Date(
    localA.getFullYear(),
    localA.getMonth(),
    localA.getDate(),
  ).getTime()
  const dayB = new Date(
    localB.getFullYear(),
    localB.getMonth(),
    localB.getDate(),
  ).getTime()
  if (dayA !== dayB) return dayA - dayB
  const aTimed = !isDateOnlyDeadline(aDate)
  const bTimed = !isDateOnlyDeadline(bDate)
  if (aTimed && !bTimed) return -1
  if (!aTimed && bTimed) return 1
  return new Date(aDate).getTime() - new Date(bDate).getTime()
}

type List = {
  id: number
  name: string
}

type FullDeal = {
  id: number
  customer_id: number
  amount?: Nullable<number>
  title?: Nullable<string>
  status?: Nullable<string>
  lost_reason?: Nullable<string>
  position?: number
  list_id: number
  due_date?: Nullable<string>
  is_won?: Nullable<number>
  sales_rep?: Nullable<string>
}

type Deal = FullDeal & DealCardData

interface DealsViewProps {
  deals: FullDeal[]
  customers: Customer[]
  lists: List[]
  imagesMap: Record<number, boolean>
  emailsMap: Record<number, boolean>
  nearestActivityMap?: Record<
    number,
    { id: number; name: string; deadline: Nullable<string>; priority?: string }
  >
  activitiesMap?: Record<number, boolean>
  activitiesIconMap?: Record<number, 'red' | 'yellow' | 'gray'>
  notesMap?: Record<number, boolean>
  groupListSelect?: React.ReactNode
  readonly?: boolean
  toolbarLeft?: React.ReactNode
  showAddDeal?: boolean
  animateBoard?: boolean
}

export default function DealsView({
  deals,
  customers,
  lists,
  imagesMap,
  emailsMap,
  nearestActivityMap,
  activitiesMap = {},
  activitiesIconMap = {},
  notesMap = {},
  groupListSelect,
  readonly = false,
  toolbarLeft,
  showAddDeal = !readonly,
  animateBoard = false,
}: DealsViewProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const toDeal = (d: FullDeal): Deal => {
    const customer = customers.find(c => c.id === d.customer_id)
    const activity = nearestActivityMap?.[d.id]
    return {
      id: d.id,
      customer_id: d.customer_id,
      name: customer ? customer.name : `Customer #${d.customer_id}`,
      company_name: customer?.company_name,
      amount: d.amount,
      title: d.title ?? undefined,
      status: d.status ?? undefined,
      lost_reason: d.lost_reason ?? undefined,
      position: d.position ?? undefined,
      list_id: d.list_id,
      due_date: d.due_date
        ? typeof d.due_date === 'string'
          ? d.due_date
          : new Date(d.due_date).toISOString().slice(0, 10)
        : null,
      has_images: imagesMap?.[d.id] || false,
      has_email: emailsMap?.[d.id] || false,
      has_activities: activitiesMap?.[d.id] || false,
      has_notes: notesMap?.[d.id] || false,
      activities_icon_color: activitiesIconMap?.[d.id],
      is_won: d.is_won,
      nearest_activity_name: activity?.name ?? null,
      nearest_activity_deadline: activity?.deadline ?? null,
      nearest_activity_id: activity?.id ?? null,
      nearest_activity_priority: activity?.priority ?? null,
      sales_rep: d.sales_rep ?? undefined,
    }
  }

  const sortDeals = (arr: Deal[]) => {
    const copy = [...arr]
    copy.sort((a, b) => {
      const aHasActivity = Boolean(a.nearest_activity_name)
      const bHasActivity = Boolean(b.nearest_activity_name)
      if (!aHasActivity && bHasActivity) return -1
      if (aHasActivity && !bHasActivity) return 1

      if (!aHasActivity && !bHasActivity) return b.id - a.id

      const aDate = a.nearest_activity_deadline
      const bDate = b.nearest_activity_deadline
      if (!aDate && !bDate) return 0
      if (!aDate) return 1
      if (!bDate) return -1
      return compareNearestActivityDeadlines(aDate, bDate)
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
  }, [
    JSON.stringify(deals),
    JSON.stringify(customers),
    JSON.stringify(lists),
    JSON.stringify(nearestActivityMap),
    JSON.stringify(activitiesMap),
    JSON.stringify(activitiesIconMap),
    JSON.stringify(notesMap),
  ])

  const [board, setBoard] = useState<Record<number, Deal[]>>(initialBoard)
  const [activeId, setActiveId] = useState<Nullable<number>>(null)
  const [highlightDealId, setHighlightDealId] = useState<Nullable<number>>(null)
  const highlightTimeoutRef = useRef<Nullable<NodeJS.Timeout>>(null)

  useEffect(() => setBoard(initialBoard), [JSON.stringify(initialBoard)])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const highlight = searchParams.get('highlight')
    if (highlight) {
      const dealId = parseInt(highlight, 10)
      if (!Number.isNaN(dealId)) {
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current)
        }
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

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 220,
        tolerance: 10,
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
      const fromClosed = fromArr[idx].is_won === 1 || fromArr[idx].is_won === 0
      const moved = {
        ...fromArr[idx],
        list_id: toListId,
        due_date: fromArr[idx].due_date,
        is_won: fromClosed ? null : fromArr[idx].is_won,
        lost_reason: fromClosed ? null : fromArr[idx].lost_reason,
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
  }

  const toolbar = (
    <div className='w-full flex flex-col sm:flex-row justify-between items-center gap-2 py-1 px-1'>
      <div className='flex items-center justify-center gap-2 w-full sm:w-auto'>
        {readonly ? toolbarLeft : null}
        {!readonly && toolbarLeft}
        {groupListSelect}
        {showAddDeal && (
          <>
            <div className='hidden md:block'>
              <Link
                to={`add?${(() => {
                  const params = new URLSearchParams(searchParams)
                  params.set('list_id', String(lists[0]?.id || 1))
                  return params.toString()
                })()}`}
                relative='path'
              >
                <Button variant='outline' size='sm' className='flex gap-2 h-9'>
                  <Plus className='w-4 h-4' /> Add Deal
                </Button>
              </Link>
            </div>
            <div className='md:hidden'>
              <CustomDropdownMenu
                trigger={
                  <Button variant='ghost' size='icon' className='h-9 w-9'>
                    <MoreVertical className='w-4 h-4' />
                  </Button>
                }
                sections={[
                  {
                    title: 'Actions',
                    options: [
                      {
                        label: 'Add New Deal',
                        icon: <Plus className='w-4 h-4' />,
                        onClick: () => {
                          const params = new URLSearchParams(searchParams)
                          params.set('list_id', String(lists[0]?.id || 1))
                          navigate(`add?${params.toString()}`)
                        },
                      },
                    ],
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>
      <FindCustomer
        disableRowClick={!readonly}
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
  )

  const toListCustomer = (d: Deal) => ({
    ...d,
    position: d.position ?? undefined,
  })

  const listsFlexClassName =
    'flex min-h-0 flex-1 max-w-full min-w-0 items-stretch gap-1 md:min-w-0 max-md:h-full max-md:gap-0 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:overscroll-x-contain max-md:snap-x max-md:snap-mandatory'

  const listColumns = lists.map(list => (
    <DealsList
      key={list.id}
      title={list.name}
      customers={(board[list.id] ?? []).map(toListCustomer)}
      id={list.id}
      readonly={readonly}
      highlightedDealId={highlightDealId ?? undefined}
      columnMotionVariants={animateBoard ? DEALS_BOARD_COLUMN_VARIANTS : undefined}
    />
  ))

  const listsContent = animateBoard ? (
    <motion.div
      key={lists.map(l => l.id).join('-')}
      className={listsFlexClassName}
      variants={DEALS_BOARD_LIST_VARIANTS}
      initial='hidden'
      animate='visible'
    >
      {listColumns}
    </motion.div>
  ) : (
    <div className={listsFlexClassName}>{listColumns}</div>
  )

  if (readonly) {
    if (animateBoard) {
      const boardAreaReadonly = (
        <div className='flex min-h-0 min-w-0 flex-1 flex-col'>{listsContent}</div>
      )
      return (
        <motion.div
          className='w-full h-[calc(100dvh-4.50rem)] md:h-[calc(100dvh-6.25rem)] flex flex-col'
          {...DEALS_SHELL_MOTION}
        >
          <motion.div
            className='shrink-0 sticky top-0 z-20 bg-white'
            {...DEALS_TOOLBAR_MOTION}
          >
            {toolbar}
          </motion.div>
          {boardAreaReadonly}
        </motion.div>
      )
    }
    return (
      <div className='w-full h-[calc(100dvh-6.25rem)] min-h-0 flex flex-col h-full'>
        <div className='shrink-0 sticky top-0 z-20 bg-white'>{toolbar}</div>
        <div className='flex min-h-0 min-w-0 h-full flex-1 flex-col'>
          {listsContent}
        </div>
      </div>
    )
  }

  const toolbarSticky = (
    <div className='shrink-0 sticky top-0 z-20 bg-white'>{toolbar}</div>
  )

  const toolbarStickyMotion = (
    <motion.div
      className='shrink-0 sticky top-0 z-20 bg-white'
      {...DEALS_TOOLBAR_MOTION}
    >
      {toolbar}
    </motion.div>
  )

  const boardArea = (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col'>{listsContent}</div>
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={args => {
        const { pointerCoordinates } = args
        const el = pointerCoordinates
          ? document.elementFromPoint(pointerCoordinates.x, pointerCoordinates.y)
          : null
        if (el?.closest('[data-dnd-ignore]')) return []
        const pointerCollisions = pointerWithin(args)
        if (pointerCollisions.length > 0) return pointerCollisions
        return closestCorners(args)
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {animateBoard ? (
        <motion.div
          className='w-full  h-[calc(100dvh-4.50rem)] md:h-[calc(100dvh-6.25rem)] flex flex-col'
          {...DEALS_SHELL_MOTION}
        >
          {toolbarStickyMotion}
          {boardArea}
        </motion.div>
      ) : (
        <div className='w-full  h-[calc(100dvh-4.50rem)] md:h-[calc(100dvh-6.25rem)] flex flex-col'>
          {toolbarSticky}
          {boardArea}
        </div>
      )}
      <DragOverlay>
        {activeId !== null
          ? (() => {
              const d = findDeal(activeId)
              if (!d) return null
              return (
                <div className='w-72 border rounded-lg p-2 shadow-md bg-white'>
                  <div className='text-lg font-semibold truncate'>{d.name}</div>
                  {d.company_name != null && String(d.company_name).trim() !== '' ? (
                    <div className='text-xs text-slate-500 truncate'>
                      {d.company_name}
                    </div>
                  ) : null}
                  {typeof d.title === 'string' && d.title.trim() ? (
                    <div className='mt-0.5 line-clamp-2 text-xs text-slate-500 break-words whitespace-pre-wrap'>
                      {d.title.trim()}
                    </div>
                  ) : null}
                  <div className='text-xs text-slate-500 mt-1'>
                    Amount: $ {d.amount ?? 0}
                  </div>
                  {d.nearest_activity_name && (
                    <div className='text-xs text-slate-600 mt-1 line-clamp-2 whitespace-pre-wrap break-words'>
                      {d.nearest_activity_name}
                    </div>
                  )}
                </div>
              )
            })()
          : null}
      </DragOverlay>
    </DndContext>
  )
}
