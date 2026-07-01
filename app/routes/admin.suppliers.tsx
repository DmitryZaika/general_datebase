import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useLoaderData,
  useLocation,
  useNavigation,
} from 'react-router'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SuppliersPageSkeleton } from '~/components/organisms/DataTableSkeleton'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { useScrollMainToTopWhenLoading } from '~/hooks/useScrollMainToTopWhenLoading'
import { isEmployeeListFilterLoading } from '~/utils/isEmployeeListFilterLoading'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface Supplier {
  id: number
  supplier_name: string
  manager: string
  phone: string
  email: string
  notes: string
}

export const meta: MetaFunction = () => {
  return [{ title: 'Admin – Suppliers' }]
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.search === nextUrl.search) {
    return false
  }
  return defaultShouldRevalidate
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getAdminUser(request)
  const suppliers = await selectMany<Supplier>(
    db,
    'SELECT id, website, supplier_name, manager, phone, email, notes from suppliers WHERE company_id = ?',
    [user.company_id],
  )
  return {
    suppliers,
  }
}

const columns: ColumnDef<Supplier>[] = [
  {
    accessorKey: 'supplier_name',
    header: ({ column }) => <SortableHeader column={column} title='Supplier Name' />,
  },
  {
    accessorKey: 'manager',
    header: ({ column }) => <SortableHeader column={column} title='Manager' />,
  },
  {
    accessorKey: 'phone',
    header: 'Phone Number',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
  },
  {
    id: 'actions',
    meta: {
      className: 'w-[50px]',
    },
    cell: ({ row }) => {
      return (
        <ActionDropdown
          actions={{
            edit: `edit/${row.original.id}/information`,
            delete: `delete/${row.original.id}`,
          }}
        />
      )
    },
  },
]

export default function Suppliers() {
  const { suppliers } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const location = useLocation()
  const isListLoading = isEmployeeListFilterLoading(navigation, location)
  useScrollMainToTopWhenLoading(isListLoading)
  const [isAddingSupplier, setIsAddingSupplier] = useState(false)

  useEffect(() => {
    if (navigation.state === 'idle') {
      if (isAddingSupplier) setIsAddingSupplier(false)
    }
  }, [navigation.state])

  const handleAddSupplierClick = () => {
    setIsAddingSupplier(true)
  }

  return (
    <div>
      <Link to={`add`} relative='path' onClick={handleAddSupplierClick}>
        <LoadingButton loading={isAddingSupplier}>
          <Plus className='w-4 h-4 mr-1' />
          Add Supplier
        </LoadingButton>
      </Link>
      {isListLoading && <SuppliersPageSkeleton />}
      <div className={isListLoading ? 'hidden' : 'animate-slide-up'}>
        <DataTable columns={columns} data={suppliers} />
      </div>
      <Outlet />
    </div>
  )
}
