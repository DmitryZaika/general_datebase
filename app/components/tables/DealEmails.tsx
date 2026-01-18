import type { ColumnDef, Row } from '@tanstack/react-table'
import { Eye, EyeClosed } from 'lucide-react'
import type { EmailHistory } from '~/crud/emails'

const DateCell = ({ row }: { row: Row<EmailHistory> }) => {
  if (row.original.read_count === 0) {
    return <EyeClosed />
  }
  return <Eye className='text-blue-500' />
}

export const customerColumns: ColumnDef<EmailHistory>[] = [
  { accessorKey: 'sent_at', header: 'Date', cell: DateCell },
  {
    accessorKey: 'subject',
    header: 'Subject',
    cell: ({ row }: { row: Row<EmailHistory> }) => {
      return row.original.subject
    },
  },
]
