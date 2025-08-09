import { useState } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import DealsList from '~/components/DealsList'
import { PageLayout } from '~/components/PageLayout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

type AdminDeal = {
  id: number
  customer_id: number
  amount: number | null
  description: string | null
  status: string | null
  list_id: number
  position: number | null
  due_date: string | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const companyId = user.company_id
    const url = new URL(request.url)
    const salesRep = url.searchParams.get('salesRep') || 'All'

    // Lists for columns
    const lists = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM deals_list WHERE deleted_at IS NULL ORDER BY position',
    )

    // Deals filtered by company (via customers.company_id) and optionally by sales rep
    const dealParams: (string | number)[] = [companyId]
    let dealSql = `
      SELECT d.id, d.customer_id, d.amount, d.description, d.status, d.list_id, d.position, d.due_date
      FROM deals d
      JOIN customers c ON d.customer_id = c.id
      JOIN users u ON d.user_id = u.id
      WHERE c.company_id = ? AND d.deleted_at IS NULL
    `
    if (salesRep && salesRep !== 'All') {
      dealSql += ' AND u.name = ?'
      dealParams.push(salesRep)
    }
    const deals = await selectMany<AdminDeal>(db, dealSql, dealParams)

    // Customers for names
    const customers = await selectMany<{ id: number; name: string }>(
      db,
      'SELECT id, name FROM customers WHERE company_id = ?',
      [companyId],
    )

    // Sales reps for filter
    const allSalesReps = await selectMany<{ name: string }>(
      db,
      `SELECT DISTINCT u.name 
       FROM users u 
       JOIN deals d ON u.id = d.user_id
       JOIN customers c ON d.customer_id = c.id
       WHERE c.company_id = ? AND d.deleted_at IS NULL`,
      [companyId],
    )
    const salesReps = ['All', ...allSalesReps.map(r => r.name)]

    return { deals, customers, lists, salesReps, filters: { salesRep } }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function AdminDeals() {
  const { deals, customers, lists, salesReps, filters } = useLoaderData<typeof loader>()
  const [selectedRep, setSelectedRep] = useState(filters.salesRep)
  const navigate = useNavigate()
  const location = useLocation()

  const onChangeRep = (value: string) => {
    setSelectedRep(value)
    const url = new URL(window.location.origin + location.pathname + location.search)
    if (value === 'All') {
      url.searchParams.delete('salesRep')
    } else {
      url.searchParams.set('salesRep', value)
    }
    navigate(url.pathname + url.search)
  }

  return (
    <PageLayout title='Deals (Admin)'>
      <div className='mb-4 flex justify-between items-center'>
        <div />
        <div className='w-64'>
          <Select value={selectedRep} onValueChange={onChangeRep}>
            <SelectTrigger>
              <SelectValue placeholder='Select Sales Rep' />
            </SelectTrigger>
            <SelectContent>
              {salesReps.map(rep => (
                <SelectItem key={rep} value={rep}>
                  {rep}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className='flex gap-4'>
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
                status: d.status ?? undefined,
                position: d.position ?? undefined,
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
              readonly
            />
          )
        })}
      </div>
    </PageLayout>
  )
}
