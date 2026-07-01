import type { ColumnDef } from '@tanstack/react-table'
import { Suspense } from 'react'
import {
  Await,
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  redirect,
  type ShouldRevalidateFunctionArgs,
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
import { Skeleton } from '~/components/ui/skeleton'
import { db } from '~/db.server'
import { canEditAdminUsers } from '~/utils/adminUsersAccess.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type SessionUser } from '~/utils/session.server'

interface User {
  id: number
  name: string
  email: string
  phone_number: string
  cloudtalk_agent_id: string | null
  cloudtalk_phone_number: string | null
  is_superuser: boolean
  company_id: number
}

interface Company {
  id: number
  name: string
}

export const meta: MetaFunction = () => {
  return [{ title: 'Admin – Users' }]
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
  let user: SessionUser
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const canEditUsers = await canEditAdminUsers(user)
  const url = new URL(request.url)
  const companyIdParam = url.searchParams.get('companyId')
  const companyId = companyIdParam ? parseInt(companyIdParam, 10) : undefined
  const effectiveCompanyId = user.is_superuser ? companyId : user.company_id

  return {
    data: loadPageData({
      effectiveCompanyId,
      isSuperUser: user.is_superuser,
      canEditUsers,
    }),
  }

  async function loadPageData({
    effectiveCompanyId,
    isSuperUser,
    canEditUsers,
  }: {
    effectiveCompanyId: number | undefined
    isSuperUser: boolean
    canEditUsers: boolean
  }) {
    const users = await selectMany<User>(
      db,
      `SELECT id, name, email, phone_number, cloudtalk_agent_id, cloudtalk_phone_number
         FROM users
        WHERE is_deleted = 0${effectiveCompanyId != null ? ' AND company_id = ?' : ''}`,
      effectiveCompanyId != null ? [effectiveCompanyId] : [],
    )

    const companies = await selectMany<Company>(db, 'SELECT id, name FROM company')

    return {
      users,
      companies,
      companyId: effectiveCompanyId ?? null,
      isSuperUser,
      canEditUsers,
    }
  }
}

const baseColumns: ColumnDef<User>[] = [
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
    accessorKey: 'cloudtalk_agent_id',
    header: 'CloudTalk Agent ID',
    cell: ({ row }) => row.original.cloudtalk_agent_id?.trim() ?? '',
  },
  {
    accessorKey: 'cloudtalk_phone_number',
    header: 'CloudTalk Phone',
    cell: ({ row }) => row.original.cloudtalk_phone_number?.trim() ?? '',
  },
]

function UserActionsCell({
  userId,
  isSuperUser,
}: {
  userId: number
  isSuperUser: boolean
}) {
  const location = useLocation()
  const actions: Record<string, string> = {
    edit: `edit/${userId}${location.search}`,
  }
  if (isSuperUser) {
    actions.delete = `delete/${userId}${location.search}`
  }
  return <ActionDropdown actions={actions} />
}

function buildColumns(canEditUsers: boolean, isSuperUser: boolean): ColumnDef<User>[] {
  if (!canEditUsers) return baseColumns
  return [
    ...baseColumns,
    {
      id: 'actions',
      cell: ({ row }) => (
        <UserActionsCell userId={row.original.id} isSuperUser={isSuperUser} />
      ),
    },
  ]
}

export default function Adminusers() {
  const { data } = useLoaderData<typeof loader>()

  return (
    <Suspense fallback={<HydrateFallback />}>
      <Await resolve={data}>{resolved => <UsersContent {...resolved} />}</Await>
    </Suspense>
  )
}

function UsersContent({
  users,
  companies,
  companyId,
  isSuperUser,
  canEditUsers,
}: {
  users: User[]
  companies: Company[]
  companyId: number | null
  isSuperUser: boolean
  canEditUsers: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const columns = buildColumns(canEditUsers, isSuperUser)

  return (
    <PageLayout title='Users'>
      {isSuperUser ? (
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
      ) : null}
      <DataTable columns={columns} data={users} />
      <Outlet />
    </PageLayout>
  )
}

export function HydrateFallback() {
  return (
    <PageLayout title='Users'>
      <div className='flex gap-2 items-end mb-3'>
        <Skeleton className='h-10 w-24' />
        <div className='space-y-1'>
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-10 w-[220px]' />
        </div>
      </div>
      <div className='space-y-2'>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className='flex items-center gap-3 py-3 border-b border-slate-100'
          >
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-4 w-48' />
            <Skeleton className='h-4 w-36' />
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-32' />
          </div>
        ))}
      </div>
    </PageLayout>
  )
}
