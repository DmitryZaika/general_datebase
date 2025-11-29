import { EnvelopeClosedIcon } from '@radix-ui/react-icons'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { MapIcon, PhoneIcon } from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useState } from 'react'
import { Link, type LoaderFunctionArgs, Outlet, redirect, useLoaderData, useLocation } from 'react-router'
import { CopyText } from '~/components/atoms/CopyText'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Button } from '~/components/ui/button'
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
            c.your_message, c.attached_file, c.qbo_id, c.notes, c.source, d.created_at as created_date
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

function AddressLinkCell({ row, customer }: { row: Row<{ key: string; value: string }>, customer: RowDataPacket }) {
  const isMobile = useIsMobile()
  const location = useLocation()
  const isNameField = row.original.key.toLowerCase() === 'name'
  const isPhoneField = row.original.key.toLowerCase() === 'phone'
  const isEmailField = row.original.key.toLowerCase() === 'email'
  const isAddressField = row.original.key.toLowerCase() === 'address'

  const handleAddressClick = () => {
    const address = String(row.original.value && customer.postal_code ? `${row.original.value}, ${customer.postal_code}` : row.original.value || '')
    if (!address) return
    const url =
      'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(address)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className='flex items-center'>
      {isPhoneField ? (
        isMobile ? (
          <div className='flex gap-2 '>
            <CopyText value={row.original.value} className='font-bold' />
          <Link
            to={`tel:${(String(row.original.value || '').match(/[+\d]/g) || []).join('')}`}
            className='font-bold break-words whitespace-normal text-ellipsis overflow-hidden border-2 border-gray-300 rounded-md px-2'
          >
           <PhoneIcon size={17} />
          </Link>
          </div>
        ) : (
           <CopyText value={row.original.value} className='font-bold' />
        )
      ) : isEmailField ? (
        <div className='flex gap-2 '>
         <CopyText value={row.original.value} className='font-bold' />
          <Link to={`email${location.search}`}>
            <Button
              variant='outline'
              aria-label='Email'
              size='icon'
              className='h-7'
            >
              <EnvelopeClosedIcon />
            </Button> 
          </Link>
        </div>
      ) : isAddressField ? (
    <div className='flex gap-2 '>
      <CopyText value={customer.address} className='font-bold' />
      <Button variant='outline' aria-label='Map' size='icon' className='h-7' onClick={handleAddressClick}>
      <MapIcon />
      </Button>
    </div>
      ) : isNameField ? (
        <CopyText value={row.original.value} className='font-bold pr-2' />
      ) : (
        <span className='font-bold break-words whitespace-normal text-ellipsis overflow-hidden'>
          {row.original.value}
        </span>
      )} 
      {isMobile && isNameField && (
        <div className='flex gap-2 justify-end'>
        <div className='flex flex-col items-end gap-2'>
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
        </div>
      )}
    </div>
  )
}

export default function DealProjectInfo() {
  const { customer } = useLoaderData<typeof loader>()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const columns: ColumnDef<{ key: string; value: string }>[] = [
    {
      header: 'Key',
      accessorKey: 'key',
    },
    {
      header: 'Value',
      accessorKey: 'value',
      cell: ({ row }) => <AddressLinkCell row={row} customer={customer} />
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
      value: k === 'created_date' ? new Date(String(v)).toLocaleDateString() : String(v),
    }))

  return (
    <div className='space-y-4'>
      <div>
        <DataTable columns={columns} data={otherFields} noHeader />
      </div>
      <Outlet />

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
