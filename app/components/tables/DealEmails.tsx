import type { ColumnDef, Row } from '@tanstack/react-table'
import { Eye, EyeClosed, Paperclip } from 'lucide-react'
import type { EmailHistory } from '~/crud/emails'

export type DealEmailThreadRow = EmailHistory & { thread_has_attachments: boolean }

function cleanDate(value: string): string {
  const date = new Date(value)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const DateCell = ({ row }: { row: Row<DealEmailThreadRow> }) => {
  if (row.original.read_count === 0) return <EyeClosed />
  return <Eye className='text-blue-500' />
}

export const customerColumns: ColumnDef<DealEmailThreadRow>[] = [
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
  {
    id: 'attachments',
    header: '',
    cell: ({ row }) =>
      row.original.thread_has_attachments ? (
        <div className='flex justify-end pr-2'>
          <Paperclip className='h-3.5 w-3.5 shrink-0 text-gray-500' />
        </div>
      ) : (
        <div className='pr-2' />
      ),
  },
]
