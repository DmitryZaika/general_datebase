import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import DealsList from '~/components/DealsList'
import { InputItem } from '~/components/molecules/InputItem'
import { Button } from '~/components/ui/button'
import { FormField, FormProvider } from '~/components/ui/form'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import {
  type DealListSchema,
  type DealsDialogSchema,
  dealListSchema,
} from '~/schemas/deals'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

export async function action({ request }: ActionFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  const resolver = zodResolver(dealListSchema)

  const { errors, data: dealListData } = await getValidatedFormData<DealListSchema>(
    request,
    resolver,
  )

  if (errors) {
    return { errors }
  }

  await db.execute('INSERT INTO deals_list (name, user_id) VALUES (?, ?)', [
    dealListData.name,
    user.id,
  ])
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
      'SELECT id, name FROM deals_list WHERE user_id = ? AND deleted_at IS NULL',
      [user.id],
    )
    const deals = await selectMany<DealsDialogSchema & { id: number }>(
      db,
      `SELECT id, customer_id, amount, description, status, list_id, position, deleted_at
       FROM deals
       WHERE deleted_at IS NULL`,
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

const AddList = ({ setOpen }: { open: boolean; setOpen: (o: boolean) => void }) => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const form = useForm<DealListSchema>({
    resolver: zodResolver(dealListSchema),
    defaultValues: { name: '' },
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(true)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setOpen])

  const fullSubmit = useFullSubmit<DealListSchema>(form)

  const onValid = () => {
    fullSubmit()
    setOpen(true)
  }

  return (
    <motion.div
      key='addlist-panel'
      ref={wrapperRef}
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 25 }}
      className='w-[260px] sm:w-[320px] h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl p-5 space-y-4'
    >
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
          New list
        </h2>
        <Button
          variant='ghost'
          type='button'
          onClick={() => setOpen(true)}
          className='text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
        >
          <X size={18} />
        </Button>
      </div>

      <FormProvider {...form}>
        <Form id='listForm' onSubmit={form.handleSubmit(onValid)}>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <InputItem field={field} inputAutoFocus placeholder='Enter list name…' />
            )}
          />

          <div className='flex justify-end gap-3 pt-1'>
            <Button type='button' variant='outline' onClick={() => setOpen(true)}>
              Cancel
            </Button>
            <Button type='submit'>Add list</Button>
          </div>
        </Form>
      </FormProvider>
    </motion.div>
  )
}

export default function EmployeeDeals() {
  const { deals, customers, lists } = useLoaderData<typeof loader>()
  const [open, setOpen] = useState(true)

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
            }
          })

        return (
          <DealsList
            key={list.id}
            title={list.name}
            customers={listDeals}
            id={list.id}
          />
        )
      })}

      {open ? (
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
      )}
      <Outlet />
    </div>
  )
}
