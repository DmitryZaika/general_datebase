import type { ColumnDef } from '@tanstack/react-table'
import { CopyText } from '~/components/atoms/CopyText'
import { DataTable } from '~/components/ui/data-table'
import type { Partner } from '~/types/partner'

const partnerColumns: ColumnDef<Partner>[] = [
  {
    accessorKey: 'company_name',
    header: 'Company Name',
    cell: ({ row }) => (
      <div className="font-semibold text-lg text-blue-900">
        {row.original.company_name}
      </div>
    ),
  },
  {
    accessorKey: 'contact_name',
    header: 'Contact Person',
    cell: ({ row }) => (
      <CopyText value={row.original.contact_name || 'N/A'} />
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => (
      <CopyText value={row.original.phone || 'N/A'} title={row.original.phone} />
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <CopyText value={row.original.email || 'N/A'} title={row.original.email} />
    ),
  },
]

interface PartnersTableProps {
  partners: Partner[]
}

export default function PartnersTable({ partners }: PartnersTableProps) {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-900">Partners</h2>
      </div>

      <div className="p-6">
        {partners.length > 0 ? (
          <DataTable
            columns={partnerColumns}
            data={partners}
          />
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No partners found</div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 border-t text-sm text-gray-600">
        Total Partners: <span className="font-semibold">{partners.length}</span>
      </div>
    </div>
  )
}
