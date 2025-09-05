import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

type CustomerInfo = {
  id: number
  name: string
  email: string | null
  phone: string | null
  address: string | null
  sales_rep_name: string | null
}

type DealRow = {
  id: number
  amount: number | null
  description: string | null
  list_name: string
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const customerId = params.customerId ? Number(params.customerId) : 0
  if (!customerId || !Number.isFinite(customerId)) {
    return redirect('..')
  }

  const customer = await selectId<CustomerInfo>(
    db,
    `SELECT c.id, c.name, c.email, c.phone, c.address, u.name AS sales_rep_name
     FROM customers c
     LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
     WHERE c.id = ?`,
    customerId,
  )

  const deals = await selectMany<DealRow>(
    db,
    `SELECT d.id, d.amount, d.description, l.name AS list_name
     FROM deals d
     JOIN deals_list l ON l.id = d.list_id
     WHERE d.customer_id = ? AND d.deleted_at IS NULL AND l.deleted_at IS NULL
     ORDER BY d.id DESC`,
    [customerId],
  )

  return { customer, deals }
}

export default function CustomerInfoDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const { customer, deals } = useLoaderData<typeof loader>() as {
    customer: CustomerInfo | null
    deals: DealRow[]
  }

  const handleChange = (open: boolean) => {
    if (open === false) navigate(`..${location.search}`)
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[560px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Customer Information</DialogTitle>
        </DialogHeader>

        {customer ? (
          <div className='space-y-4'>
            <div className='border rounded p-4'>
              <div className='text-lg font-semibold'>{customer.name}</div>
              <div className='text-sm text-slate-600 mt-2'>
                <div>Email: {customer.email || '-'}</div>
                <div>Phone: {customer.phone || '-'}</div>
                <div>Address: {customer.address || '-'}</div>
                <div>Sales Rep: {customer.sales_rep_name || 'Not assigned'}</div>
              </div>
            </div>

            <div className='border rounded p-4'>
              <div className='text-md font-semibold mb-2'>Deals</div>
              {deals.length === 0 ? (
                <div className='text-sm text-slate-500'>No deals found</div>
              ) : (
                <ul className='space-y-2'>
                  {deals.map(d => (
                    <li key={d.id} className='border rounded p-2'>
                      <div className='text-sm font-medium'>
                        Amount: $ {Number(d.amount || 0)}
                      </div>
                      <div className='text-xs text-slate-500'>Stage: {d.list_name}</div>
                      {d.description && (
                        <div className='text-sm text-slate-600 mt-1 whitespace-pre-wrap'>
                          {d.description}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className='text-sm text-slate-500'>Customer not found</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
