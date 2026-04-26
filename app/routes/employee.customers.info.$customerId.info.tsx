import { format } from 'date-fns'
import { useOutletContext } from 'react-router'
import { CopyText } from '~/components/atoms/CopyText'
import { CustomerActivityTimeline } from '~/components/organisms/CustomerActivityTimeline'
import type { EmailHistory } from '~/crud/emails'

type CustomerInfo = {
  id: number
  name: string
  email: string | null
  phone: string | null
  phone_2: string | null
  address: string | null
  company_name: string | null
  sales_rep_name: string | null
  source: string | null
  created_date: string | null
  parent_id: number | null
}

type DealRow = {
  id: number
  amount: number | null
  lost_reason: string | null
  list_name: string
  created_at: string | null
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

export async function loader() {
  return null
}

export default function CustomerInfoTab() {
  const { customer, deals, project, emails } = useOutletContext<{
    customer: CustomerInfo | null
    deals: DealRow[]
    project: ProjectInfo | null
    emails: EmailHistory[]
  }>()

  if (!customer) {
    return <div className='text-sm text-slate-500'>Customer not found</div>
  }

  const projectFields =
    project &&
    (() => {
      const locationValue =
        project.city || project.state || project.postal_code
          ? `${project.city || ''} ${project.state || ''} ${project.postal_code || (project.company_name ? project.company_name : '') || ''}`.trim()
          : ''
      const fields = [
        { label: 'Location', value: locationValue },
        { label: 'Remodal type', value: project.remodal_type },
        { label: 'Project size', value: project.project_size },
        { label: 'Contact time', value: project.contact_time },
        { label: 'Tear out', value: project.remove_and_dispose },
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
    <div className='space-y-4 mt-4'>
      <div className='border rounded p-4'>
        <div className='text-lg font-semibold'>
          {customer.company_name ? 'Contact name: ' : ''}
          <CopyText value={customer.name} title={customer.name} />
        </div>
        <div className='text-sm text-slate-600 mt-2'>
          {customer.company_name && <div>Company: {customer.company_name}</div>}
          <div>
            Email:{' '}
            {customer.email ? (
              <CopyText value={customer.email} title={customer.email} />
            ) : (
              '-'
            )}
          </div>
          <div>
            Phone 1:{' '}
            {customer.phone ? (
              <CopyText value={customer.phone} title={customer.phone} />
            ) : (
              '-'
            )}
          </div>
          <div>
            Phone 2:{' '}
            {customer.phone_2 ? (
              <CopyText value={customer.phone_2} title={customer.phone_2} />
            ) : (
              '-'
            )}
          </div>
          <div>
            Address:{' '}
            {customer.address ? (
              <CopyText value={customer.address} title={customer.address} />
            ) : (
              '-'
            )}
          </div>
          <div>Sales Rep: {customer.sales_rep_name || 'Not assigned'}</div>
          <div>Source: {customer.source || 'Not assigned'}</div>
          <div>
            Created:{' '}
            {customer.created_date
              ? format(new Date(customer.created_date), 'M/d/yyyy')
              : '-'}
          </div>
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
                    <span className='font-semibold'>$ {Number(d.amount || 0)}</span>
                  </div>
                  <div className='text-xs text-slate-500'>
                    <span className='font-semibold'>Stage:</span> {d.list_name}
                  </div>
                  {d.created_at && (
                    <div className='text-xs text-slate-500'>
                      <span className='font-semibold'>Created:</span>{' '}
                      {format(new Date(d.created_at), 'M/d/yyyy')}
                    </div>
                  )}
                </div>
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

      <CustomerActivityTimeline
        phone={customer.phone}
        phone2={customer.phone_2}
        emails={emails}
      />
    </div>
  )
}
