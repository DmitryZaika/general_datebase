import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { PageLayout } from '~/components/PageLayout'
import { DataTable } from '~/components/ui/data-table'
import { Input } from '~/components/ui/input'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface Instructions {
  id: number
  title: string
  parent_id: number
  after_id: number
  rich_text: string
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getAdminUser(request)
  const instructions = await selectMany<Instructions>(
    db,
    'select id, title, parent_id, after_id, rich_text from instructions WHERE company_id = ?',
    [user.company_id],
  )
  return { instructions }
}

const instructionsColumn: ColumnDef<Instructions>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'parent_id',
    header: 'Parent Id',
  },
  {
    accessorKey: 'after_id',
    header: 'Order',
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return (
        <ActionDropdown
          actions={{
            edit: `edit/${row.original.id}`,
            delete: `delete/${row.original.id}`,
          }}
        />
      )
    },
  },
]

export default function AdminInstructions() {
  const { instructions } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const [isAddingInstruction, setIsAddingInstruction] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (navigation.state === 'idle') {
      if (isAddingInstruction) setIsAddingInstruction(false)
    }
  }, [navigation.state])

  const handleAddInstructionClick = () => {
    setIsAddingInstruction(true)
  }

  const filteredInstructions = instructions.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <PageLayout title='Instructions'>
      <div className='flex gap-4 justify-between mb-4'>
        <Link to={`add`} relative='path' onClick={handleAddInstructionClick}>
          <LoadingButton loading={isAddingInstruction}>
            <Plus className='w-4 h-4 mr-1' />
            Add Instruction
          </LoadingButton>
        </Link>
        <div className='relative flex-1 max-w-sm '>
          <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search instructions...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='pl-8'
          />
        </div>
      </div>
      <DataTable
        columns={instructionsColumn}
        data={filteredInstructions}
        onRowClick={(row: Instructions) => {
          navigate(`edit/${row.id}`)
        }}
        rowClassName='cursor-pointer'
      />
      <Outlet />
    </PageLayout>
  )
}
