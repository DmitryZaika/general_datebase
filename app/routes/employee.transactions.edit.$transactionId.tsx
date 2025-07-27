import {
  type LoaderFunctionArgs,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError } from '~/utils/toastHelpers'

interface SaleDetails {
  id: number
  customer_id: number
  customer_name: string
  sale_date: string
  seller_id: number
  seller_name: string
}

interface SaleSlab {
  id: number
  stone_id: number
  bundle: string
  stone_name: string
  cut_date: string | null
  notes: string | null
  square_feet: number | null
}

interface SaleSink {
  id: number
  sink_type_id: number
  name: string
  price: number
  is_deleted: number
}

function formatDate(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  if (!params.transactionId) {
    return forceRedirectError(request.headers, 'No transaction ID provided')
  }

  const saleId = parseInt(params.transactionId, 10)
  if (Number.isNaN(saleId)) {
    return forceRedirectError(request.headers, 'Invalid transaction ID format')
  }

  const checkSales = await selectMany<{ id: number; company_id: number }>(
    db,
    `SELECT id, company_id FROM sales WHERE id = ?`,
    [saleId],
  )

  if (checkSales.length === 0) {
    return forceRedirectError(request.headers, 'Transaction does not exist in database')
  }

  if (checkSales[0].company_id !== user.company_id) {
    return forceRedirectError(
      request.headers,
      'Transaction belongs to different company',
    )
  }

  const sales = await selectMany<SaleDetails>(
    db,
    `SELECT 
      s.id, s.customer_id, c.name as customer_name, 
      s.sale_date, s.seller_id, u.name as seller_name
     FROM sales s
     JOIN customers c ON s.customer_id = c.id
     JOIN users u ON s.seller_id = u.id
     WHERE s.id = ? AND s.company_id = ?`,
    [saleId, user.company_id],
  )

  const sale = sales[0]

  if (!sale) {
    return forceRedirectError(
      request.headers,
      'Transaction details could not be retrieved',
    )
  }

  const slabs = await selectMany<SaleSlab>(
    db,
    `SELECT 
      slab_inventory.id, slab_inventory.stone_id, slab_inventory.bundle, stones.name as stone_name, 
      slab_inventory.cut_date, slab_inventory.notes, slab_inventory.square_feet
     FROM slab_inventory
     JOIN stones ON slab_inventory.stone_id = stones.id
     WHERE slab_inventory.sale_id = ?
     ORDER BY slab_inventory.id`,
    [saleId],
  )

  const sinks = await selectMany<SaleSink>(
    db,
    `SELECT 
      sinks.id, sinks.sink_type_id, sink_type.name, sinks.price, sinks.is_deleted
     FROM sinks
     JOIN sink_type ON sinks.sink_type_id = sink_type.id
     JOIN slab_inventory ON sinks.slab_id = slab_inventory.id
     WHERE slab_inventory.sale_id = ? AND sinks.is_deleted = 0
     ORDER BY sinks.id`,
    [saleId],
  )

  return {
    sale,
    slabs,
    sinks,
  }
}

export default function ViewTransaction() {
  const { sale, slabs, sinks } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      navigate(`/employee/transactions${location.search}`)
    }
  }

  // Calculate total price of sinks
  const totalSinkPrice = sinks.reduce((total, sink) => total + (sink.price || 0), 0)

  // Calculate total square feet - ensure it's a number
  const totalSquareFeet = slabs.reduce((total, slab) => {
    const slabSqFt = slab.square_feet || 0
    return total + slabSqFt
  }, 0)

  return (
    <Dialog open={true} onOpenChange={handleDialogClose}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 py-4'>
          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-semibold mb-2'>Sale Information</h3>
              <div className='grid grid-cols-2 gap-y-2'>
                <div className='font-medium'>Customer:</div>
                <div>{sale.customer_name}</div>

                <div className='font-medium'>Sale Date:</div>
                <div>{formatDate(sale.sale_date)}</div>

                <div className='font-medium'>Sold By:</div>
                <div>{sale.seller_name}</div>
              </div>
            </div>

            <div>
              <h3 className='text-lg font-semibold mb-2'>Slabs</h3>
              {slabs.length === 0 ? (
                <p className='text-gray-500'>No slabs in this transaction</p>
              ) : (
                <div className='border rounded-md'>
                  <table className='min-w-full divide-y divide-gray-200'>
                    <thead className='bg-gray-50'>
                      <tr>
                        <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Bundle
                        </th>
                        <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Stone
                        </th>
                        <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          SF
                        </th>
                        <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Status
                        </th>
                        <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className='bg-white divide-y divide-gray-200'>
                      {slabs.map(slab => (
                        <tr key={slab.id}>
                          <td className='px-4 py-2 whitespace-nowrap text-sm'>
                            {slab.bundle}
                          </td>
                          <td className='px-4 py-2 whitespace-nowrap text-sm'>
                            {slab.stone_name}
                          </td>
                          <td className='px-4 py-2 whitespace-nowrap text-sm'>
                            {slab.square_feet || 'N/A'}
                          </td>
                          <td className='px-4 py-2 whitespace-nowrap text-sm'>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                slab.cut_date
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {slab.cut_date ? 'Cut' : 'Uncut'}
                            </span>
                          </td>
                          <td className='px-4 py-2 text-sm max-w-[150px] break-words'>
                            {slab.notes || '-'}
                          </td>
                        </tr>
                      ))}
                      {totalSquareFeet > 0 && (
                        <tr className='bg-gray-50'>
                          <td colSpan={2} className='px-4 py-2 text-sm font-medium'>
                            Total Square Feet:
                          </td>
                          <td colSpan={3} className='px-4 py-2 text-sm font-medium'>
                            {Number(totalSquareFeet).toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-semibold mb-2'>Sinks</h3>
              {sinks.length === 0 ? (
                <p className='text-gray-500'>No sinks in this transaction</p>
              ) : (
                <div className='border rounded-md'>
                  <table className='min-w-full divide-y divide-gray-200'>
                    <thead className='bg-gray-50'>
                      <tr>
                        <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Type
                        </th>
                        <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className='bg-white divide-y divide-gray-200'>
                      {sinks.map(sink => (
                        <tr key={sink.id}>
                          <td className='px-4 py-2 whitespace-nowrap text-sm'>
                            {sink.name}
                          </td>
                          <td className='px-4 py-2 whitespace-nowrap text-sm'>
                            {formatCurrency(sink.price)}
                          </td>
                        </tr>
                      ))}
                      {sinks.length > 0 && (
                        <tr className='bg-gray-50'>
                          <td className='px-4 py-2 text-sm font-medium'>Total:</td>
                          <td className='px-4 py-2 text-sm font-medium'>
                            {formatCurrency(totalSinkPrice)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='flex justify-end mt-4'>
          <Button
            variant='outline'
            onClick={() => navigate(`/employee/transactions${location.search}`)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
      <Outlet />
    </Dialog>
  )
}
