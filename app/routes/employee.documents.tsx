import type { ColumnDef } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
} from 'react-router'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import {
  EMPLOYEE_VIEW_ENTER,
  employeeViewMotionKey,
} from '~/utils/employeeViewEnterMotion'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface ItemDocument {
  id: number
  name: string
  url: string | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getEmployeeUser(request)
  const documents = await selectMany<ItemDocument>(
    db,
    'SELECT id, name, url FROM documents WHERE company_id = ?',
    [user.company_id],
  )
  return { documents }
}
const columns: ColumnDef<ItemDocument>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <a
        href={row.original.url || ''}
        target='_blank'
        className='text-blue-600 underline hover:text-blue-800'
      >
        {row.original.name}
      </a>
    ),
  },
]

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>()
  const location = useLocation()

  return (
    <motion.div
      key={employeeViewMotionKey(location.pathname, location.search)}
      className='w-full min-h-0'
      {...EMPLOYEE_VIEW_ENTER}
    >
      <h1 className='text-2xl font-bold'>Documents</h1>
      <DataTable columns={columns} data={documents} />
    </motion.div>
  )
}
