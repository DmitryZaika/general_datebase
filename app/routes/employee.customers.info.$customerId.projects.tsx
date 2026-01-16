import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, ChevronDown, Link, MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type ActionFunctionArgs, type LoaderFunctionArgs, useFetcher, useLoaderData, useNavigate, useParams } from 'react-router'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Input } from '~/components/ui/input'
import { db } from '~/db.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await getEmployeeUser(request)
  const customerId = params.customerId ? Number(params.customerId) : 0

  if (!customerId) return { customers: [], effectiveParentId: 0 }

  const customer = await selectId<{ parent_id: number | null }>(
    db,
    'SELECT parent_id FROM customers WHERE id = ?',
    customerId,
  )

  const effectiveParentId = customer?.parent_id || customerId

  const customers = await selectMany<{
    id: number
    name: string
    email: string | null
    phone: string | null
    address: string | null
    sales_rep_name: string | null
    deal_stage: string | null
    source: string | null
    city: string | null
    state: string | null
    postal_code: string | null
    company_name: string | null
    notes: string | null
  }>(
    db,
    `SELECT 
        c.id, 
        c.name, 
        c.email, 
        c.phone, 
        c.address,
        c.source,
        c.city,
        c.state,
        c.postal_code,
        c.company_name,
        c.notes,
        u.name AS sales_rep_name,
        (SELECT dl.name 
         FROM deals d 
         JOIN deals_list dl ON d.list_id = dl.id 
         WHERE d.customer_id = c.id AND d.deleted_at IS NULL 
         ORDER BY d.id DESC LIMIT 1) as deal_stage
     FROM customers c
     LEFT JOIN users u ON c.sales_rep = u.id
     WHERE (c.parent_id = ? OR c.id = ?) AND c.deleted_at IS NULL
     ORDER BY c.name ASC`,
    [effectiveParentId, effectiveParentId],
  )

  const customerIds = customers.map(c => c.id)

  const sales =
    customerIds.length > 0
      ? await selectMany<{
          id: number
          customer_id: number
          price: number
          project_address: string | null
          sale_date: string
        }>(
          db,
          `SELECT id, customer_id, price, project_address, sale_date
           FROM sales
           WHERE customer_id IN (${customerIds.map(() => '?').join(',')})`,
          customerIds,
        )
      : []

  const customersWithSales = customers.map(c => {
    const customerSales = sales.filter(s => s.customer_id === c.id)
    return {
      ...c,
      sales: customerSales,
    }
  })

  return { customers: customersWithSales, effectiveParentId }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'link-customer') {
    const targetCustomerId = formData.get('targetCustomerId')
    const parentId = formData.get('parentId')

    if (!targetCustomerId || !parentId) {
      return null
    }

    await db.execute(
      'UPDATE customers SET parent_id = ? WHERE id = ? AND company_id = ?',
      [parentId, targetCustomerId, user.company_id],
    )

    return { success: true }
  }
  return null
}

export default function CompanyCustomers() {
  const { customers, effectiveParentId } = useLoaderData<typeof loader>()
  const params = useParams()
  const currentCustomerId = Number(params.customerId)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number, name: string } | null>(null)
  const navigate = useNavigate()
  const searchFetcher = useFetcher<{ customers: { id: number; name: string }[] }>()
  const linkFetcher = useFetcher()

  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

  useEffect(() => {
    if (searchTerm.length >= 2 && (!selectedCustomer || selectedCustomer.name !== searchTerm)) {
      const timeoutId = setTimeout(() => {
        searchFetcher.load(`/api/customers/search?term=${encodeURIComponent(searchTerm)}&searchType=name`)
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [searchTerm, selectedCustomer])

  const handleLinkCustomer = () => {
    if (selectedCustomer && effectiveParentId) {
      linkFetcher.submit(
        {
          intent: 'link-customer',
          targetCustomerId: selectedCustomer.id.toString(),
          parentId: effectiveParentId.toString(),
        },
        { method: 'post' },
      )
      setSearchTerm('')
      setSelectedCustomer(null)
    }
  }

  return (
    <div className='mt-4 space-y-4 pb-6'>
      <div className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-slate-400' />
          <Input
            placeholder='Search to link existing customer...'
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value)
              if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                setSelectedCustomer(null)
              }
            }}
            className='pl-9'
          />
          {searchFetcher.data?.customers && searchTerm.length >= 2 && !selectedCustomer && (
            <div className='absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto'>
              {searchFetcher.data.customers.length === 0 ? (
                <div className='p-2 text-sm text-slate-500'>No customers found</div>
              ) : (
                searchFetcher.data.customers.map(c => (
                  <div
                    key={c.id}
                    className='p-2 hover:bg-slate-50 cursor-pointer text-sm'
                    onClick={() => {
                      setSearchTerm(c.name)
                      setSelectedCustomer({ id: c.id, name: c.name })
                    }}
                  >
                    {c.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <LoadingButton
          className='gap-2' 
          onClick={handleLinkCustomer}
          loading={linkFetcher.state === 'submitting'}
        >
          <Link className='w-4 h-4' />
          Link Customer
        </LoadingButton>
      </div>

      {customers.length === 0 ? (
        <div className='text-sm text-slate-500 text-center py-8'>
          No other customers found for this company
        </div>
      ) : (
        <div className='grid gap-3'>
          {customers.map(c => {
            const isExpanded = expandedId === c.id
            const locationValue =
              c.city || c.state || c.postal_code
                ? `${c.city || ''} ${c.state || ''} ${c.postal_code || ''}`.trim()
                : ''
            
            const isCurrentCustomer = c.id === currentCustomerId
            const displayName = isCurrentCustomer && c.company_name ? c.company_name : c.name

            return (
              <div
                key={c.id}
                className={`border rounded-lg bg-white transition-all overflow-hidden ${
                  isExpanded ? 'ring-2 ring-slate-200 shadow-sm' : 'hover:bg-slate-50 hover:shadow-sm'
                }`}
              >
                <div
                  className='p-4 cursor-pointer'
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className='flex justify-between items-start gap-4'>
                    <div className='flex-1 min-w-0'>
                      <div className='font-bold text-slate-900 truncate flex items-center gap-2'>
                        {displayName}
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      <div className='text-xs text-slate-500 space-y-0.5 mt-1 truncate'>
                        {c.email && <div className='truncate'>{c.email}</div>}
                        {c.phone && <div>{c.phone}</div>}
                      </div>

                      <div className='mt-3 flex flex-wrap gap-2'>
                        {c.deal_stage ? (
                          <div className='inline-flex items-center gap-1.5 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-100 font-semibold uppercase tracking-wider'>
                            <span className='w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse' />
                            {c.deal_stage}
                          </div>
                        ) : (
                          <div className='text-[10px] bg-slate-50 text-slate-400 px-2 py-1 rounded-md border border-slate-100 font-medium uppercase tracking-wider italic'>
                            No active deals
                          </div>
                        )}
                      </div>
                    </div>
                    <div className='flex flex-col items-end gap-2 shrink-0'>
                      {c.sales_rep_name && (
                        <div className='text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 uppercase font-bold tracking-tight'>
                          {c.sales_rep_name}
                        </div>
                      )}
                    
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className='px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50'>
                        {c.sales.length > 0 ? (
                          <div className='pt-4'>
                            <div className='flex items-center gap-2 mb-3'>
                              <div className='h-px flex-1 bg-slate-200' />
                              <span className='text-xs font-bold text-slate-400 uppercase tracking-widest'>
                                Projects History
                              </span>
                              <div className='h-px flex-1 bg-slate-200' />
                            </div>
                            <div className='grid gap-2'>
                              {c.sales.map(s => (
                                <div
                                  key={s.id}
                                  className='group flex items-center justify-between bg-white p-3 rounded-md border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all'
                                >
                                  <div className='flex flex-col gap-1'>
                                    <div className='flex items-center gap-1.5 font-medium text-slate-700 text-sm'>
                                      <MapPin className='w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors' />
                                      <span>
                                        {s.project_address || 'No address provided'}
                                      </span>
                                    </div>
                                    <div className='flex items-center gap-1.5 text-xs text-slate-400'>
                                      <Calendar className='w-3 h-3' />
                                      <span>
                                        {new Date(s.sale_date).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className='text-right'>
                                    <div className='text-emerald-600 font-bold text-sm'>
                                      {currency.format(s.price)}
                                    </div>
                                 
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className='pt-4 text-center text-xs text-slate-400 italic'>
                            No completed projects found
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
