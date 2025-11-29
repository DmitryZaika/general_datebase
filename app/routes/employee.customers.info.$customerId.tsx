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
  source: string | null
  created_at: string | null
}

type DealRow = {
  id: number
  amount: number | null
  description: string | null
  lost_reason: string | null
  list_name: string
}

type ProjectInfo = {
  city: string | null
  state: string | null
  postal_code: string | null
  company_name: string | null
  remodal_type: string | null
  project_size: string | null
  contact_time: string | null
  remove_and_dispose: string | null
  improve_offer: string | null
  sink: string | null
  when_start: string | null
  details: string | null
  compaign_name: string | null
  adset_name: string | null
  ad_name: string | null
  backsplash: string | null
  kitchen_stove: string | null
  your_message: string | null
  attached_file: string | null
  qbo_id: string | null
  notes: string | null
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
    `SELECT c.id, c.name, c.email, c.phone, c.address, u.name AS sales_rep_name, c.source
     FROM customers c
     LEFT JOIN deals d ON d.customer_id = c.id AND d.created_at IS NULL
     LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
     WHERE c.id = ?`,
    customerId,
  )

  const project = await selectId<ProjectInfo>(
    db,
    `SELECT c.city, c.state, c.postal_code, c.company_name,
            c.remodal_type, c.project_size, c.contact_time, c.remove_and_dispose,
            c.improve_offer, c.sink, c.when_start, c.details, c.compaign_name,
            c.adset_name, c.ad_name, c.backsplash, c.kitchen_stove,
            c.your_message, c.attached_file, c.qbo_id, c.notes
       FROM customers c
      WHERE c.id = ?`,
    customerId,
  )

  const deals = await selectMany<DealRow>(
    db,
    `SELECT d.id, d.amount, d.description, d.lost_reason, l.name AS list_name
     FROM deals d
     JOIN deals_list l ON l.id = d.list_id
     WHERE d.customer_id = ? AND d.deleted_at IS NULL AND l.deleted_at IS NULL
     ORDER BY d.id DESC`,
    [customerId],
  )

  return { customer, deals, project }
}

export default function CustomerInfoDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const { customer, deals, project } = useLoaderData<typeof loader>() as {
    customer: CustomerInfo | null
    deals: DealRow[]
    project: ProjectInfo | null
  }

  const handleChange = (open: boolean) => {
    if (open === false) navigate(`..${location.search}`)
  }

  const projectFields =
    project &&
    (() => {
      const locationValue =
        project.city || project.state || project.postal_code
          ? `${project.city || ''} ${project.state || ''} ${project.postal_code || ''}`.trim()
          : ''
      const fields = [
        { label: 'Company', value: project.company_name },
        { label: 'Location', value: locationValue },
        { label: 'Remodal type', value: project.remodal_type },
        { label: 'Project size', value: project.project_size },
        { label: 'Contact time', value: project.contact_time },
        { label: 'Remove and dispose', value: project.remove_and_dispose },
        { label: 'Improve offer', value: project.improve_offer },
        { label: 'Sink', value: project.sink },
        { label: 'When start', value: project.when_start },
        { label: 'Backsplash', value: project.backsplash },
        { label: 'Kitchen stove', value: project.kitchen_stove },
        { label: 'Your message', value: project.your_message },
        { label: 'Notes', value: project.notes },
        { label: 'QBO ID', value: project.qbo_id },
        { label: 'Campaign', value: project.compaign_name },
        { label: 'Ad set', value: project.adset_name },
        { label: 'Ad name', value: project.ad_name },
      ]
      return fields.filter(f => f.value && String(f.value).trim() !== '')
    })()

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
                <div>Source: {customer.source || 'Not assigned'}</div>
             
              </div>
            </div>

            {projectFields && projectFields.length > 0 && (
              <div className='border rounded p-4'>
                <div className='text-md font-semibold mb-2'>Project</div>
                <div className='text-sm text-slate-600 space-y-1'>
                  {projectFields.map(field => (
                    <div key={field.label}>
                      {field.label}: {field.value}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className='border rounded p-4'>
              <div className='text-md font-semibold mb-2'>Deals</div>
              {deals.length === 0 ? (
                <div className='text-sm text-slate-500'>No deals found</div>
              ) : (
                <ul className='space-y-2'>
                  {deals.map(d => (
                    <li key={d.id} className='border rounded p-3 bg-white'>
                      <div className='space-y-1 text-sm text-slate-700'>
                        <div className='flex items-baseline justify-between gap-4'>
                          <span className='font-semibold text-slate-800'>Amount</span>
                          <span className='font-semibold'>
                            $ {Number(d.amount || 0)}
                          </span>
                        </div>
                        <div className='text-xs text-slate-500'>
                          <span className='font-semibold'>Stage:</span> {d.list_name}
                        </div>
                      </div>
                      {d.description && (
                        <div className='text-sm text-slate-600 mt-1 whitespace-pre-wrap'>
                          <span className='font-semibold'>Description:</span>{' '}
                          {d.description}
                        </div>
                      )}
                      {d.lost_reason && (
                        <div className='text-sm text-slate-600 mt-1 whitespace-pre-wrap'>
                          <span className='font-semibold text-red-600'>Lost reason:</span>{' '}
                          {d.lost_reason}
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
