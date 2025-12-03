import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Form,
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
import { forceRedirectError } from '~/utils/toastHelpers.server'

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

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request)
  if (!params.transactionId) {
    return forceRedirectError(request.headers, 'No transaction ID provided')
  }

  const saleId = parseInt(params.transactionId, 10)
  if (Number.isNaN(saleId)) {
    return forceRedirectError(request.headers, 'Invalid transaction ID format')
  }

  const formData = await request.formData()
  const intent = formData.get('intent')
  if (intent !== 'cut-slab') {
    return null
  }

  const slabIdValue = formData.get('slabId')
  const slabId = typeof slabIdValue === 'string' ? Number(slabIdValue) : 0
  if (!slabId || !Number.isFinite(slabId)) {
    return null
  }

  const slabs = await selectMany<{ id: number; sale_id: number; cut_date: string | null }>(
    db,
    `SELECT id, sale_id, cut_date FROM slab_inventory WHERE id = ? AND sale_id = ?`,
    [slabId, saleId],
  )

  if (slabs.length === 0) {
    return null
  }

  if (slabs[0].cut_date === null) {
    await db.execute(`UPDATE slab_inventory SET cut_date = CURRENT_TIMESTAMP WHERE id = ?`, [
      slabId,
    ])
  }

  const remaining = await selectMany<{ count: number }>(
    db,
    `SELECT COUNT(*) as count FROM slab_inventory WHERE sale_id = ? AND cut_date IS NULL AND deleted_at IS NULL`,
    [saleId],
  )

  const remainingCount = remaining[0]?.count ?? 0
  const status = remainingCount > 0 ? 'partially cut' : 'cut'
  await db.execute(`UPDATE sales SET status = ? WHERE id = ?`, [status, saleId])

  return null
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
      <DialogContent className='min-w-[500px] max-w-6xl'>
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-6 py-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='border rounded-md p-4'>
              <h3 className='text-lg font-semibold mb-2'>Sale Information</h3>
              <div className='grid grid-cols-2 gap-y-2 text-sm'>
                <div className='font-medium'>Customer:</div>
                <div>{sale.customer_name}</div>

                <div className='font-medium'>Sale Date:</div>
                <div>{formatDate(sale.sale_date)}</div>

                <div className='font-medium'>Sold By:</div>
                <div>{sale.seller_name}</div>
              </div>
            </div>

            <div className='border rounded-md p-4'>
              <h3 className='text-lg font-semibold mb-2'>Sinks</h3>
              {sinks.length === 0 ? (
                <p className='text-sm text-gray-500'>No sinks in this transaction</p>
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

          <div className='flex justify-center'>
            <div className='w-full'>
              <h3 className='text-lg font-semibold mb-2'>Slabs</h3>
              {slabs.length === 0 ? (
                <p className='text-gray-500'>No slabs in this transaction</p>
              ) : (
                <div className='border h-full rounded-md shadow-sm w-full overflow-hidden'>
                  <table className='min-w-full h-full divide-y divide-gray-200'>
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
                        <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Cut Date
                        </th>
                        <th className='px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Actions
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
                          <td className='px-4 py-2 whitespace-nowrap text-sm'>
                            {slab.cut_date ? formatDate(slab.cut_date) : '-'}
                          </td>
                          <td className='px-4 py-2 whitespace-nowrap text-right text-sm'>
                            {!slab.cut_date && (
                              <Form method='post'>
                                <input type='hidden' name='intent' value='cut-slab' />
                                <input type='hidden' name='slabId' value={String(slab.id)} />
                                <Button type='submit' size='sm' variant='outline'>
                                  Cut
                                </Button>
                              </Form>
                            )}
                          </td>
                        </tr>
                      ))}
                      {totalSquareFeet > 0 && (
                        <tr className='bg-gray-50'>
                          <td colSpan={2} className='px-4 py-2 text-sm font-medium'>
                            Total Square Feet:
                          </td>
                          <td colSpan={5} className='px-4 py-2 text-sm font-medium'>
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
