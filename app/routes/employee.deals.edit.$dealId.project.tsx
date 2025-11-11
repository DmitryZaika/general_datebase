import type { ColumnDef } from '@tanstack/react-table'
import type { RowDataPacket } from 'mysql2'
import { useState } from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { DataTable } from '~/components/ui/data-table'
import { VCard } from '~/components/VCard'
import { db } from '~/db.server'
import { useIsMobile } from '~/hooks/use-mobile'
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
            c.your_message, c.attached_file, c.qbo_id, c.notes, c.source
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

export default function DealProjectInfo() {
  const { customer } = useLoaderData<typeof loader>()
  const isMobile = useIsMobile()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)

  const columns: ColumnDef<{ key: string; value: string }>[] = [
    {
      header: 'Key',
      accessorKey: 'key',
    },
    {
      header: 'Value',
      accessorKey: 'value',
      cell: ({ row }) => {
        const isNameField = row.original.key.toLowerCase() === 'name'
        const isPhoneField = row.original.key.toLowerCase() === 'phone'

        return (
          <div className='flex items-center gap-2'>
            {isPhoneField ? (
              isMobile ? (
                <a
                  href={`tel:${(String(row.original.value || '').match(/[+\d]/g) || []).join('')}`}
                  className='font-bold break-words whitespace-normal text-ellipsis overflow-hidden border-2 border-gray-300 rounded-md px-2'
                >
                  {row.original.value}
                </a>
              ) : (
                <span className='font-bold break-words whitespace-normal text-ellipsis overflow-hidden'>
                  {row.original.value}
                </span>
              )
            ) : (
              <span className='font-bold break-words whitespace-normal text-ellipsis overflow-hidden'>
                {row.original.value}
              </span>
            )}
            {isMobile && isNameField && (
              <div className='flex flex-col items-end ml-auto '>
                <VCard
                  className='border-2 h-6 rounded-md px-2'
                  name={customer.name || ''}
                  phone={customer.phone || ''}
                  email={customer.email || ''}
                  company={customer.company_name || ''}
                  address={
                    `${customer.address} ${customer.postal_code}` ||
                    `${customer.city} ${customer.postal_code}` ||
                    ''
                  }
                />
              </div>
            )}
          </div>
        )
      },
    },
  ]

  // Extract attached_file separately to render as image
  const attachedFile = customer.attached_file

  // Create images array for SuperCarousel
  const images = attachedFile
    ? [
        {
          id: 1,
          url: String(attachedFile),
          name: 'Attached Project File',
          type: 'project',
          available: null,
        },
      ]
    : []

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
            className='max-w-full h-auto rounded-lg shadow-lg border cursor-pointer'
            onClick={() => setCurrentId(1)}
          />
        </div>
      )}

      <SuperCarousel
        type='project'
        currentId={currentId}
        setCurrentId={setCurrentId}
        images={images}
        userRole='employee'
        showInfo={false}
      />
    </div>
  )
}
