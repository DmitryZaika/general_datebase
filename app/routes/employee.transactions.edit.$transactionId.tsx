import { Calendar, MapPin, User, UserCircle } from 'lucide-react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Form,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from 'react-router'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
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
  project_address: string | null
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
      s.sale_date, s.seller_id, u.name as seller_name, s.project_address
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
  if (intent === 'cut-slab') {
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
  } else if (intent === 'uncut-slab') {
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

    if (slabs[0].cut_date !== null) {
      await db.execute(`UPDATE slab_inventory SET cut_date = NULL WHERE id = ?`, [
        slabId,
      ])
    }
  } else {
    return null
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
  const navigation = useNavigation()

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
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                  Sale Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 text-sm'>
                  <div className='flex items-center justify-between border-b pb-2 last:border-0 last:pb-0'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <User className='h-4 w-4' />
                      <span>Customer</span>
                    </div>
                    <span className='font-medium'>{sale.customer_name}</span>
                  </div>
                  <div className='flex items-center justify-between border-b pb-2 last:border-0 last:pb-0'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <Calendar className='h-4 w-4' />
                      <span>Sale Date</span>
                    </div>
                    <span className='font-medium'>{formatDate(sale.sale_date)}</span>
                  </div>
                  <div className='flex items-center justify-between border-b pb-2 last:border-0 last:pb-0'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <UserCircle className='h-4 w-4' />
                      <span>Sold By</span>
                    </div>
                    <span className='font-medium'>{sale.seller_name}</span>
                  </div>
                  <div className='flex items-center justify-between border-b pb-2 last:border-0 last:pb-0'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <MapPin className='h-4 w-4' />
                      <span>Project Address</span>
                    </div>
                    <span className='font-medium text-right'>
                      {sale.project_address || 'No address'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-lg font-semibold'>Sinks</CardTitle>
              </CardHeader>
              <CardContent>
                {sinks.length === 0 ? (
                  <p className='text-sm text-muted-foreground py-4 text-center italic'>
                    No sinks in this transaction
                  </p>
                ) : (
                  <div className='rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sinks.map(sink => (
                          <TableRow key={sink.id}>
                            <TableCell>{sink.name}</TableCell>
                            <TableCell>{formatCurrency(sink.price)}</TableCell>
                          </TableRow>
                        ))}
                        {sinks.length > 0 && (
                          <TableRow className='bg-muted/50 font-medium'>
                            <TableCell>Total:</TableCell>
                            <TableCell>{formatCurrency(totalSinkPrice)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-lg font-semibold'>Slabs</CardTitle>
            </CardHeader>
            <CardContent>
              {slabs.length === 0 ? (
                <p className='text-muted-foreground text-center py-8'>
                  No slabs in this transaction
                </p>
              ) : (
                <div className='rounded-md border'>
                  <Table className='p-2'>
                    <TableHeader >
                      <TableRow>
                        <TableHead className='px-2'>Bundle</TableHead>
                        <TableHead>Stone</TableHead>
                        <TableHead>SF</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Cut Date</TableHead>
                        <TableHead className='text-right'>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slabs.map(slab => (
                        <TableRow key={slab.id}>
                          <TableCell className='font-medium px-2'>{slab.bundle}</TableCell>
                          <TableCell>{slab.stone_name}</TableCell>
                          <TableCell>{slab.square_feet || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={slab.cut_date ? 'secondary' : 'outline'}
                              className={
                                slab.cut_date
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                  : 'bg-green-100 text-green-800 hover:bg-green-100 border-transparent'
                              }
                            >
                              {slab.cut_date ? 'Cut' : 'Uncut'}
                            </Badge>
                          </TableCell>
                          <TableCell className='max-w-[200px] truncate' title={slab.notes || ''}>
                            {slab.notes || '-'}
                          </TableCell>
                          <TableCell>
                            {slab.cut_date ? formatDate(slab.cut_date) : '-'}
                          </TableCell>
                          <TableCell className='text-right'>
                            {!slab.cut_date ? (
                              <Form method='post'>
                                <input type='hidden' name='intent' value='cut-slab' />
                                <input type='hidden' name='slabId' value={String(slab.id)} />
                                <LoadingButton
                                  type='submit'
                                  size='sm'
                                  variant='outline'
                                  className='h-7'
                                  loading={
                                    navigation.formData?.get('intent') === 'cut-slab' &&
                                    navigation.formData?.get('slabId') === String(slab.id)
                                  }
                                >
                                  Cut
                                </LoadingButton>
                              </Form>
                            ) : (
                              <Form method='post'>
                                <input type='hidden' name='intent' value='uncut-slab' />
                                <input type='hidden' name='slabId' value={String(slab.id)} />
                                <LoadingButton
                                  type='submit'
                                  size='sm'
                                  variant='outline'
                                  className='h-7 text-red-600 hover:text-red-700 hover:bg-red-50'
                                  loading={
                                    navigation.formData?.get('intent') === 'uncut-slab' &&
                                    navigation.formData?.get('slabId') === String(slab.id)
                                  }
                                >
                                  Uncut
                                </LoadingButton>
                              </Form>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {totalSquareFeet > 0 && (
                        <TableRow className='bg-muted/50 font-medium'>
                          <TableCell colSpan={2} className='px-2'>Total Square Feet:</TableCell>
                          <TableCell colSpan={5}>
                            {Number(totalSquareFeet).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
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
