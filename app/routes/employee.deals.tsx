import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  type DealListSchema,
  type DealsDialogSchema,
  dealListSchema,
} from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

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
  const resolver = zodResolver(dealListSchema)

  const { errors } = await getValidatedFormData<DealListSchema>(request, resolver)

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
    const deals = await selectMany<
      DealsDialogSchema & { id: number; user_id: number; due_date: string | null }
    >(
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

  return (
    <div className='flex  gap-4'>
      {lists.map(list => {
        const listDeals = deals
          .filter(d => d.list_id === list.id)
          .map(d => {
            const customer = customers.find(c => c.id === d.customer_id)
            return {
              id: d.id,
              customer_id: d.customer_id,
              name: customer ? customer.name : `Customer #${d.customer_id}`,
              amount: d.amount,
              description: d.description,
              status: d.status,
              position: d.position,
              list_id: d.list_id,
              due_date: d.due_date
                ? typeof d.due_date === 'string'
                  ? d.due_date
                  : new Date(d.due_date).toISOString().slice(0, 10)
                : null,
            }
          })

        // sort by due_date (earliest first, nulls last)
        listDeals.sort((a, b) => {
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        })
        return (
          <DealsList
            key={list.id}
            title={list.name}
            customers={listDeals}
            id={list.id}
            lists={lists}
          />
        )
      })}

      {/* {open ? (
        <Button
          variant='outline'
          className='mt-1 rounded-md'
          onClick={() => setOpen(false)}
          onBlur={() => setOpen(false)}
        >
          <Plus />
          Add another list
        </Button>
      ) : (
        <AnimatePresence>
          {!open && <AddList key='addlist' open={open} setOpen={setOpen} />}
        </AnimatePresence>
      )} */}
      <Outlet />
    </div>
  )
}
