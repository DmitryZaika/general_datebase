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
import { useEffect, useMemo, useState } from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import DealsList from '~/components/DealsList'
import { db } from '~/db.server'
import { type DealsDialogSchema, dealsSchema } from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

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
    const customers = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM customers WHERE company_id = ?',
      [user.company_id],
    )
    return { deals, customers, lists }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

// const AddList = ({ setOpen }: { open: boolean; setOpen: (o: boolean) => void }) => {
//   const wrapperRef = useRef<HTMLDivElement>(null)
//   const form = useForm<DealListSchema>({
//     resolver: zodResolver(dealListSchema),
//     defaultValues: { name: '' },
//   })

//   useEffect(() => {
//     function handleClickOutside(e: MouseEvent) {
//       if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
//         setOpen(true)
//       }
//     }
//     document.addEventListener('mousedown', handleClickOutside)
//     return () => document.removeEventListener('mousedown', handleClickOutside)
//   }, [setOpen])

//   const fullSubmit = useFullSubmit<DealListSchema>(form)

//   const onValid = () => {
//     fullSubmit()
//     setOpen(true)
//   }

//   return (
//     <motion.div
//       key='addlist-panel'
//       ref={wrapperRef}
//       initial={{ x: -320, opacity: 0 }}
//       animate={{ x: 0, opacity: 1 }}
//       exit={{ x: -320, opacity: 0 }}
//       transition={{ type: 'spring', stiffness: 260, damping: 25 }}
//       className='w-[260px] sm:w-[320px] h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl p-5 space-y-4'
//     >
//       <div className='flex items-center justify-between'>
//         <h2 className='text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
//           New list
//         </h2>
//         <Button
//           variant='ghost'
//           type='button'
//           onClick={() => setOpen(true)}
//           className='text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
//         >
//           <X size={18} />
//         </Button>
//       </div>

//       <FormProvider {...form}>
//         <Form id='listForm' onSubmit={form.handleSubmit(onValid)}>
//           <FormField
//             control={form.control}
//             name='name'
//             render={({ field }) => (
//               <InputItem field={field} inputAutoFocus placeholder='Enter list name…' />
//             )}
//           />

//           <div className='flex justify-end gap-3 pt-1'>
//             <Button type='button' variant='outline' onClick={() => setOpen(true)}>
//               Cancel
//             </Button>
//             <Button type='submit'>Add list</Button>
//           </div>
//         </Form>
//       </FormProvider>
//     </motion.div>
//   )
// }

export default function EmployeeDeals() {
  const { deals, customers, lists } = useLoaderData<typeof loader>()

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

  useEffect(() => setBoard(initialBoard), [JSON.stringify(initialBoard)])

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

  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id)
    setActiveId(id)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = Number(active.id)
    // support dropping over a list container (empty list) or over another deal
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

    // If same list or invalid drop target, do nothing (sorting is automatic)
    if (fromListId === toListId) return

    // Move deal to new list, then sort both lists and persist
    setBoard(prev => {
      const copy = { ...prev }
      const fromArr = [...(copy[fromListId] || [])]
      const toArr = [...(copy[toListId] || [])]
      const idx = fromArr.findIndex(d => d.id === activeId)
      if (idx === -1) return prev
      const moved = { ...fromArr[idx], list_id: toListId }
      fromArr.splice(idx, 1)
      toArr.push(moved)
      copy[fromListId] = sortDeals(fromArr)
      copy[toListId] = sortDeals(toArr)
      return copy
    })

    // Persist only the moved deal's list change. Positions inside lists are managed by sort rule.
    await fetch('/api/deals/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [{ id: activeId, list_id: toListId, position: 0 }],
      }),
    })
    setActiveId(null)
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
      <div className='flex  gap-4'>
        {lists.map(list => (
          <DealsList
            key={list.id}
            title={list.name}
            customers={board[list.id] ?? []}
            id={list.id}
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
    </DndContext>
  )
}
