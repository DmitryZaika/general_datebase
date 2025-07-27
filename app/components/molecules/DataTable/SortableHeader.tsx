import type { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '~/components/ui/button'

interface IProps<T> {
  column: Column<T, unknown>
  title: string
}

export const SortableHeader = <T,>({ column, title }: IProps<T>) => (
  <Button
    variant='ghost'
    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    className='select-none p-0 h-8 min-w-0 justify-start text-left font-medium'
    style={{ width: 'auto' }}
  >
    {title}
    {column.getIsSorted() === 'asc' ? (
      <ArrowUp className='ml-1 h-3 w-3' />
    ) : column.getIsSorted() === 'desc' ? (
      <ArrowDown className='ml-1 h-3 w-3' />
    ) : (
      <ArrowUpDown className='ml-1 h-3 w-3' />
    )}
  </Button>
)
