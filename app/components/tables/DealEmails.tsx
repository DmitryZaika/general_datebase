import type { ColumnDef, Row } from '@tanstack/react-table'
import { Eye, EyeClosed } from 'lucide-react'
import type { EmailHistory } from '~/crud/emails'

function cleanDate(value: string): string {
  const date = new Date(value)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const DateCell = ({ row }: { row: Row<EmailHistory> }) => {
  if (row.original.read_count === 0) return <EyeClosed />
  return <Eye className='text-blue-500' />
}

export const customerColumns: ColumnDef<EmailHistory>[] = [
  { accessorKey: 'read', header: 'Read', cell: DateCell },
  {
    accessorKey: 'sent_at',
    header: 'Date',
    cell: ({ row }) => cleanDate(row.original.sent_at),
  },
  {
    accessorKey: 'subject',
    header: 'Subject',
    cell: ({ row }) => row.original.subject,
  },
]
