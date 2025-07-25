import type { ColumnDef } from '@tanstack/react-table'
import { FaFile } from 'react-icons/fa'
import { Link, type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface Supplier {
  id: number
  supplier_name: string
  manager?: string
  phone?: string
  notes?: string
  email?: string
  website?: string
}

interface SupplierFile {
  id: number
  supplier_id: number
  name: string
  url: string
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const suppliers = await selectMany<Supplier>(
      db,
      'SELECT id, website, supplier_name, manager, phone, email, notes FROM suppliers WHERE company_id = ?',
      [user.company_id],
    )

    if (suppliers.length === 0) {
      return { suppliers: [], filesMap: {} }
    }

    const supplierIds = suppliers.map(s => s.id)

    const allFiles = await selectMany<{ supplier_id: number } & SupplierFile>(
      db,
      'SELECT id, supplier_id, name, url FROM supplier_files WHERE supplier_id IN (?) AND EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.company_id = ?)',
      [supplierIds, user.company_id],
    )

    const filesMap: Record<number, SupplierFile[]> = {}
    allFiles.forEach(file => {
      if (!filesMap[file.supplier_id]) {
        filesMap[file.supplier_id] = []
      }
      filesMap[file.supplier_id].push({
        id: file.id,
        supplier_id: file.supplier_id,
        name: file.name,
        url: file.url,
      })
    })

    return { suppliers, filesMap }
  } catch (error) {
    console.error('Error loading suppliers:', error)
    return { suppliers: [], filesMap: {} }
  }
}

const getColumns = (
  filesMap: Record<number, SupplierFile[]>,
): ColumnDef<Supplier>[] => [
  {
    accessorKey: 'supplier_name',
    header: 'Supplier Name',
    cell: ({ row }) => (
      <Link
        to={row.original.website || ''}
        className='text-blue-600 hover:underline'
        target='_blank'
      >
        {row.original.supplier_name}
      </Link>
    ),
  },
  {
    accessorKey: 'manager',
    header: 'Manager',
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
    id: 'files',
    header: 'Files',
    cell: ({ row }) => {
      const files = filesMap[row.original.id] || []
      const fileObject = files.reduce<Record<string, string>>((acc, file) => {
        acc[file.name] = file.url
        return acc
      }, {})
      return <ActionDropdown asBlank={true} label='Files' actions={fileObject} />
    },
  },
]

export default function Suppliers() {
  const { suppliers, filesMap } = useLoaderData<typeof loader>()
  return <DataTable columns={getColumns(filesMap)} data={suppliers} />
}
