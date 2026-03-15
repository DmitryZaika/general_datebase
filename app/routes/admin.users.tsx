import type { ColumnDef } from '@tanstack/react-table'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface User {
  id: number
  name: string
  email: string
  phone_number: string
  is_superuser: boolean
  company_id: number
}

interface Company {
  id: number
  name: string
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const url = new URL(request.url)
  const companyIdParam = url.searchParams.get('companyId')
  const companyId = companyIdParam ? parseInt(companyIdParam) : undefined

  const effectiveCompanyId = user.is_superuser ? companyId : user.company_id

  const users = await selectMany<User>(
    db,
    `select id, name, email, phone_number from users WHERE is_deleted = 0${effectiveCompanyId ? ' AND company_id = ?' : ''}`,
    effectiveCompanyId ? [effectiveCompanyId] : [],
  )

  const companies = await selectMany<Company>(db, 'SELECT id, name FROM company')

  return {
    users,
    companies,
    companyId: effectiveCompanyId ?? null,
    isSuperUser: user.is_superuser,
  }
}

const adminColumns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: 'Name*',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'phone_number',
    header: 'Phone Number',
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const location = useLocation()
      return (
        <ActionDropdown
          actions={{
            edit: `edit/${row.original.id}${location.search}`,
            delete: `delete/${row.original.id}${location.search}`,
          }}
        />
      )
    },
  },
]

export default function Adminusers() {
  const { users, companies, companyId, isSuperUser } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()

  const columns = isSuperUser
    ? adminColumns
    : adminColumns.filter(col => col.id !== 'actions')

  return (
    <PageLayout title='Users'>
      {isSuperUser && (
        <div className='flex gap-2 items-end'>
          <Link to={`add`} relative='path' className='mb-3'>
            <Button>Add User</Button>
          </Link>
          <div className='my-3'>
            <label className='block text-sm font-medium mb-1'>Company</label>
            <Select
              value={companyId ? String(companyId) : 'all'}
              onValueChange={val => {
                const params = new URLSearchParams(location.search)
                if (val === 'all') params.delete('companyId')
                else params.set('companyId', val)
                navigate({ pathname: location.pathname, search: params.toString() })
              }}
            >
              <SelectTrigger className='min-w-[220px] '>
                <SelectValue placeholder='Select company' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All companies</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <DataTable columns={columns} data={users} />
      <Outlet />
    </PageLayout>
  )
}
