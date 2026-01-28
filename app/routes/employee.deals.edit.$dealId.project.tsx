import { EnvelopeClosedIcon } from '@radix-ui/react-icons'
import { useMutation } from '@tanstack/react-query'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { MapIcon, PhoneIcon } from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router'
import { CopyText } from '~/components/atoms/CopyText'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import type { ToastProps } from '~/components/ui/toast'
import { VCard } from '~/components/VCard'
import { db } from '~/db.server'
import { useIsMobile } from '~/hooks/use-mobile'
import { toast } from '~/hooks/use-toast'
import type { loader as rootLoader } from '~/root'
import { getEmployeeUser } from '~/utils/session.server'

type ToastFunction = (props: ToastProps & { description: string }) => void

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await getEmployeeUser(request)
  if (!params.dealId) {
    throw new Error('Deal ID is missing')
  }
  const dealId = parseInt(params.dealId, 10)

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.name, c.email, c.phone, c.phone_2, c.address, c.city, c.state, c.postal_code, c.company_name,
            c.remodal_type, c.project_size, c.contact_time, c.remove_and_dispose, c.improve_offer, c.sink,
            c.when_start, c.details, c.compaign_name, c.adset_name, c.ad_name, c.backsplash, c.kitchen_stove,
            c.your_message, c.attached_file, c.qbo_id, c.notes, c.source,d.created_at as deal_created, d.is_won, c.created_date as customer_created
       FROM deals d
       JOIN customers c ON d.customer_id = c.id
      WHERE d.id = ? AND c.company_id = ?`,
    [dealId, user.company_id],
  )
  if (!rows || rows.length === 0) return redirect('/employee/deals')
  return { customer: rows[0] }
}

function AddressLinkCell({
  row,
  customer,
}: {
  row: Row<{ key: string; value: string }>
  customer: RowDataPacket
}) {
  const isMobile = useIsMobile()
  const location = useLocation()

  // Получаем ключ в нижнем регистре один раз для удобства
  const keyLower = row.original.key.toLowerCase()

  const isNameField = keyLower === 'name'
  const isPhoneField = keyLower === 'phone'
  // ИСПРАВЛЕНИЕ: здесь проверяем 'phone 2' с пробелом, так как данные были отформатированы
  const isPhone2Field = keyLower === 'phone 2'
  const isEmailField = keyLower === 'email'
  const isAddressField = keyLower === 'address'

  const handleAddressClick = () => {
    const address = String(
      row.original.value && customer.postal_code
        ? `${row.original.value}, ${customer.postal_code}`
        : row.original.value || '',
    )
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
      ) : isPhone2Field ? (
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
          // Теперь этот блок будет работать для Phone 2
          <CopyText value={row.original.value} className='font-bold' />
        )
      ) : isEmailField ? (
        <div className='flex gap-2 '>
          <CopyText value={row.original.value} className='font-bold' />
          <Link to={`email${location.search}`}>
            <Button variant='outline' aria-label='Email' size='icon' className='h-7'>
              <EnvelopeClosedIcon />
            </Button>
          </Link>
        </div>
      ) : isAddressField ? (
        <div className='flex gap-2 '>
          <CopyText value={customer.address} className='font-bold' />
          <Button
            variant='outline'
            aria-label='Map'
            size='icon'
            className='h-7'
            onClick={handleAddressClick}
          >
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
  const { dealId } = useParams()
  const rootData = useRouteLoaderData<typeof rootLoader>('root')
  const token = rootData?.token
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const navigate = useNavigate()

  const setWon = async ({
    id,
    is_won,
    token,
  }: {
    id: number
    is_won: number | null
    token: string
  }) => {
    const response = await fetch('/api/deals/set-won', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token || '',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ id, is_won }),
    })
    if (!response.ok) {
      throw new Error('Failed to update deal status')
    }
    return response.json()
  }

  const setWonMutation = (
    toast: ToastFunction,
    token: string,
    onSuccess?: (id: number, is_won: number | null) => void,
  ) => {
    return {
      mutationFn: (variables: { id: number; is_won: number | null }) =>
        setWon({ ...variables, token }),
      onSuccess: (_: unknown, variables: { id: number; is_won: number | null }) => {
        onSuccess?.(variables.id, variables.is_won)
      },
      onError: (error: unknown) => {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Something went wrong. Please try again.',
          variant: 'destructive',
        })
      },
    }
  }
  const { mutate } = useMutation(
    setWonMutation(toast, token || '', () => {
      toast({
        title: 'Success',
        description: 'Deal status updated',
        variant: 'success',
      })
      navigate(`/employee/deals`)
    }),
  )

  const handleStatusChange = (status: 1 | 0 | null) => {
    if (!dealId) return
    mutate({ id: Number(dealId), is_won: status })
  }

  const columns: ColumnDef<{ key: string; value: string }>[] = [
    {
      header: 'Key',
      accessorKey: 'key',
    },
    {
      header: 'Value',
      accessorKey: 'value',
      cell: ({ row }) => <AddressLinkCell row={row} customer={customer} />,
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
      // Здесь происходит преобразование '_' в пробел, поэтому 'phone_2' становится 'Phone 2'
      key: k.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase()),
      value:
        k === 'customer_created'
          ? new Date(String(v)).toLocaleDateString()
          : k === 'deal_created'
            ? new Date(String(v)).toLocaleDateString()
            : String(v),
    }))

  function MoveButton({
    status,
    isWon,
  }: {
    status: 0 | 1 | null
    isWon: 0 | 1 | null
  }) {
    const name = { 0: 'Lost', 1: 'Won', null: 'Move to Active' }
    if (isWon === status) return null

    return (
      <Button
        variant={status === 0 ? 'destructive' : status === 1 ? 'success' : 'default'}
        className='h-7'
        onClick={() => handleStatusChange(status)}
      >
        {name[status as keyof typeof name]}
      </Button>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex gap-2'>
        <MoveButton status={null} isWon={customer.is_won} />
        <MoveButton status={1} isWon={customer.is_won} />
        <MoveButton status={0} isWon={customer.is_won} />
      </div>
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
