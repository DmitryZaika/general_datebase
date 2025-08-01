import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { DataTable } from '~/components/ui/data-table'

import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface Document {
  id: number
  name: string
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const user = await getAdminUser(request)
  const documents = await selectMany<Document>(
    db,
    'SELECT id, name FROM documents WHERE company_id = ?',
    [user.company_id],
  )
  return { documents }
}

const documentColumns: ColumnDef<Document>[] = [
  {
    accessorKey: 'name',
    header: 'Document Name',
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
            edit: `edit/${row.original.id}`,
            delete: `delete/${row.original.id}`,
          }}
        />
      )
    },
  },
]

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const [isAddingDocument, setIsAddingDocument] = useState(false)

  useEffect(() => {
    if (navigation.state === 'idle') {
      if (isAddingDocument) setIsAddingDocument(false)
    }
  }, [navigation.state])

  const handleAddDocumentClick = () => {
    setIsAddingDocument(true)
  }

  return (
    <div>
      <Link to={`add`} relative='path' onClick={handleAddDocumentClick}>
        <LoadingButton loading={isAddingDocument}>
          <Plus className='w-4 h-4 mr-1' />
          Add Document
        </LoadingButton>
      </Link>
      <DataTable columns={documentColumns} data={documents} />
      <Outlet />
    </div>
  )
}
