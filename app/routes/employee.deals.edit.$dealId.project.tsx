import { EnvelopeClosedIcon } from '@radix-ui/react-icons'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { MapIcon, PhoneIcon } from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useEffect, useState } from 'react'
import {
  type ActionFunctionArgs,
  data,
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { CopyText } from '~/components/atoms/CopyText'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { VCard } from '~/components/VCard'
import { db } from '~/db.server'
import { useIsMobile } from '~/hooks/use-mobile'
import { useToast } from '~/hooks/use-toast'
import { commitSession, getSession } from '~/sessions.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

// --- LOADER ---
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await getEmployeeUser(request)
  if (!params.dealId) throw new Error('Deal ID is missing')

  const dealId = parseInt(params.dealId, 10)

  // 1. Get available Groups
  const groupLists = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT id, name FROM groups_list WHERE deleted_at IS NULL AND is_displayed = 1 AND (company_id = ? OR id = 1)`,
    [user.company_id],
  )

  // 2. Get Customer & Deal info
  const rows = await selectMany<RowDataPacket>(
    db,
    `SELECT c.name, c.email, c.phone, c.phone_2, c.address, c.city, c.state, c.postal_code, c.company_name,
            c.remodal_type, c.project_size, c.contact_time, c.remove_and_dispose, c.improve_offer, c.sink,
            c.when_start, c.details, c.compaign_name, c.adset_name, c.ad_name, c.backsplash, c.kitchen_stove,
            c.your_message, c.attached_file, c.qbo_id, c.notes, c.source,
            d.created_at as deal_created, d.is_won, d.list_id as current_list_id, l.group_id as current_group_id, c.created_date as customer_created
       FROM deals d JOIN customers c ON d.customer_id = c.id LEFT JOIN deals_list l ON d.list_id = l.id WHERE d.id = ? AND c.company_id = ?`,
    [dealId, user.company_id],
  )

  if (!rows || rows.length === 0) return redirect('/employee/deals')
  return { customer: rows[0], groupLists }
}

// --- ACTION ---
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const user = await getEmployeeUser(request)
  const dealId = parseInt(params.dealId || '0', 10)
  if (!dealId) throw new Error('Deal ID is missing')
  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''
  const formData = await request.formData()
  const intent = formData.get('intent')

  try {
    // 1. Update Status (Won/Lost)
    if (intent === 'update_status') {
      const isWonRaw = formData.get('is_won')
      const isWon = isWonRaw === 'null' ? null : Number(isWonRaw)

      await db.execute(`UPDATE deals SET is_won = ? WHERE id = ? AND user_id = ?`, [
        isWon,
        dealId,
        user.id,
      ])
      const session = await getSession(request.headers.get('Cookie'))
      session.flash('message', toastData('Success', 'Deal status updated successfully'))
      return redirect(`/employee/deals${searchString}`, {
        headers: { 'Set-Cookie': await commitSession(session) },
      })
    }

    // 2. Update Group (Move deal to the first list of the selected group)
    if (intent === 'change_group') {
      const groupId = formData.get('group_id')
      if (!groupId) throw new Error('Group ID is missing')

      // Find the list with the SMALLEST ID in this group
      const lists = await selectMany<{ id: number }>(
        db,
        `SELECT id FROM deals_list WHERE group_id = ? ORDER BY id ASC LIMIT 1`,
        [Number(groupId)],
      )

      if (!lists || lists.length === 0) {
        return { success: false, error: 'No lists found for this group' }
      }

      const targetListId = lists[0].id

      // Update the deal to point to this list
      await db.execute(`UPDATE deals SET list_id = ? WHERE id = ? AND user_id = ?`, [
        targetListId,
        dealId,
        user.id,
      ])
      await db.execute(
        'UPDATE deal_stage_history SET exited_at = NOW() WHERE deal_id = ? AND exited_at IS NULL',
        [dealId],
      )
      await db.execute(
        'INSERT INTO deal_stage_history (deal_id, list_id) VALUES (?, ?)',
        [dealId, targetListId],
      )
      const session = await getSession(request.headers.get('Cookie'))
      session.flash('message', toastData('Success', 'Group updated successfully'))
      return redirect(`/employee/deals${searchString}`, {
        headers: { 'Set-Cookie': await commitSession(session) },
      })
    }
  } catch (error) {
    posthogClient.captureException(error, 'Failed to update deal', {
      dealId,
    })
    return data({ error: 'Failed to update deal' })
  }

  return data({ success: true })
}

// --- HELPER COMPONENT ---
function AddressLinkCell({
  row,
  customer,
}: {
  row: Row<{ key: string; value: string }>
  customer: RowDataPacket
}) {
  const isMobile = useIsMobile()
  const location = useLocation()
  const keyLower = row.original.key.toLowerCase()

  const isNameField = keyLower === 'name'
  const isPhoneField = keyLower === 'phone'
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
      {isPhoneField || isPhone2Field ? (
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
              address={`${customer.address || ''} ${customer.postal_code || ''}`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function DealProjectInfo() {
  const { customer, groupLists } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<{ success: boolean; message?: string; error?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.success) {
        toast({
          title: 'Success',
          description: fetcher.data.message || 'Updated successfully',
          variant: 'success',
        })
      } else if (fetcher.data.error) {
        toast({
          title: 'Error',
          description: fetcher.data.error,
          variant: 'destructive',
        })
      }
    }
  }, [fetcher.state, fetcher.data, toast])

  const handleStatusChange = (status: 1 | 0 | null) => {
    if (status === 0) {
      const pathParts = location.pathname.split('/')
      const dealId = pathParts[pathParts.indexOf('edit') + 1]
      navigate(
        `/employee/deals/reason?dealId=${dealId}&fromListId=${customer.current_list_id}&fromPos=0&is_won=0${location.search}`,
      )
      return
    }
    fetcher.submit(
      { intent: 'update_status', is_won: status === null ? 'null' : String(status) },
      { method: 'POST' },
    )
  }

  const handleGroupChange = (newGroupId: string) => {
    fetcher.submit({ intent: 'change_group', group_id: newGroupId }, { method: 'POST' })
  }

  const columns: ColumnDef<{ key: string; value: string }>[] = [
    { header: 'Key', accessorKey: 'key' },
    {
      header: 'Value',
      accessorKey: 'value',
      cell: ({ row }) => <AddressLinkCell row={row} customer={customer} />,
    },
  ]

  const attachedFile = customer.attached_file
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

  // Data Formatting
  const otherFields = Object.entries(customer)
    .filter(
      ([k, v]) =>
        v != null &&
        k !== 'attached_file' &&
        k !== 'current_group_id' &&
        k !== 'is_won',
    )
    .map(([k, v]) => ({
      key: k.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase()),
      value: k.includes('created')
        ? new Date(String(v)).toLocaleDateString()
        : String(v),
    }))

  // Helper Button
  function MoveButton({
    status,
    isWon,
  }: {
    status: 0 | 1 | null
    isWon: 0 | 1 | null
  }) {
    const name = { 0: 'Lost', 1: 'Won', null: 'Move to Active' }
    const isCurrent = isWon === status

    // Check if this specific button is currently submitting
    const isSubmitting =
      fetcher.state !== 'idle' &&
      fetcher.formData?.get('intent') === 'update_status' &&
      fetcher.formData?.get('is_won') === (status === null ? 'null' : String(status))

    if (isCurrent) return null

    return (
      <Button
        variant={status === 0 ? 'destructive' : status === 1 ? 'success' : 'default'}
        className='h-7'
        disabled={isSubmitting}
        onClick={() => handleStatusChange(status)}
      >
        {isSubmitting ? 'Saving...' : name[status as keyof typeof name]}
      </Button>
    )
  }

  const currentGroupId = customer.current_group_id
    ? String(customer.current_group_id)
    : undefined

  return (
    <div className='space-y-4'>
      <div className='flex gap-2 items-center flex-wrap'>
        <MoveButton status={null} isWon={customer.is_won} />
        <MoveButton status={1} isWon={customer.is_won} />
        <MoveButton status={0} isWon={customer.is_won} />

        <Select onValueChange={handleGroupChange} defaultValue={currentGroupId}>
          <SelectTrigger className='w-[200px] h-7'>
            <SelectValue placeholder='Select Group' />
          </SelectTrigger>
          <SelectContent>
            {groupLists.map(group => (
              <SelectItem key={group.id} value={String(group.id)}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
