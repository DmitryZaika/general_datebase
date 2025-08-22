import type { ColumnDef } from '@tanstack/react-table'
import type { RowDataPacket } from 'mysql2'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await getEmployeeUser(request)
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name, c.email, c.phone, c.address, c.city, c.state, c.postal_code, c.company_name,
            c.remodal_type, c.project_size, c.contact_time, c.remove_and_dispose, c.improve_offer, c.sink,
            c.when_start, c.details, c.compaign_name, c.adset_name, c.ad_name, c.backsplash, c.kitchen_stove,
            c.your_message, c.attached_file, c.qbo_id, c.notes
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ? AND c.company_id = ?`,
    [dealId, user.company_id],
  )
  if (!rows || rows.length === 0) {
    return redirect('/employee/deals')
  }
  return { customer: rows[0] }
}

const columns: ColumnDef<{ key: string; value: string }>[] = [
  {
    header: 'Key',
    accessorKey: 'key',
  },
  {
    header: 'Value',
    accessorKey: 'value',
    cell: ({ row }) => (
      <span className='font-bold break-words whitespace-normal text-ellipsis overflow-hidden'>
        {row.original.value}
      </span>
    ),
  },
]
export default function DealProjectInfo() {
  const { customer } = useLoaderData<typeof loader>()

  // Extract attached_file separately to render as image
  const attachedFile = customer.attached_file
  const otherFields = Object.entries(customer)
    .filter(([k, v]) => v != null && k !== 'attached_file')
    .map(([k, v]) => ({
      key: k.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase()),
      value: String(v),
    }))

  return (
    <div className='space-y-4'>
      <div>
        <DataTable columns={columns} data={otherFields} noHeader />
      </div>

      {attachedFile && (
        <div className='mt-6'>
          <p className='font-bold mb-2'>Attached File:</p>
          <img
            src={String(attachedFile)}
            alt='Attached project file'
            className='max-w-full h-auto rounded-lg shadow-lg border'
            onError={e => {
              // If image fails to load, show as link instead
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const link = document.createElement('a')
              link.href = String(attachedFile)
              link.textContent = String(attachedFile)
              link.target = '_blank'
              link.className = 'text-blue-600 hover:text-blue-800 underline'
              target.parentNode?.appendChild(link)
            }}
          />
        </div>
      )}
    </div>
  )
}
