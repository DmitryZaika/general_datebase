import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { motion, type Variants } from 'framer-motion'
import { useState } from 'react'

import { Button } from '~/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

const STAGGER_TABLE_BODY_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.085,
      delayChildren: 0.05,
    },
  },
}

const STAGGER_TABLE_ROW_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
      mass: 0.72,
    },
  },
}

const MotionTableRow = motion(TableRow)

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  noHeader?: boolean
  onRowClick?: (row: TData) => void
  rowClassName?: string | ((row: TData) => string)
  paginate?: boolean
  pageSize?: number
  getRowId?: (row: TData) => string
  animateRowEntrance?: boolean
}

function getRowClassName<TData>(
  row: TData,
  rowClassName?: string | ((row: TData) => string),
): string {
  if (typeof rowClassName === 'function') {
    return rowClassName(row)
  }
  if (typeof rowClassName === 'string' && rowClassName.length > 0) {
    return rowClassName
  }
  const anyRow: any = row
  if (anyRow && typeof anyRow.className === 'string') {
    return anyRow.className
  }
  return ''
}

export function DataTable<TData, TValue>({
  columns,
  data,
  noHeader = false,
  onRowClick,
  rowClassName,
  paginate = false,
  pageSize,
  getRowId,
  animateRowEntrance = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const initialPageSize = paginate ? pageSize || 50 : data.length || 1
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  })
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    state: {
      sorting,
      pagination,
    },
  })

  return (
    <div className='rounded-md border'>
      <Table>
        {!noHeader && (
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className='select-none pl-4'
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
        )}
        {animateRowEntrance ? (
          <motion.tbody
            className='[&_tr:last-child]:border-0'
            variants={STAGGER_TABLE_BODY_VARIANTS}
            initial='hidden'
            animate='visible'
          >
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <MotionTableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={getRowClassName(row.original, rowClassName)}
                  onClick={() => onRowClick?.(row.original)}
                  variants={STAGGER_TABLE_ROW_VARIANTS}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className='whitespace-nowrap pl-1.5 sm:pl-2 '>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </MotionTableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </motion.tbody>
        ) : (
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={getRowClassName(row.original, rowClassName)}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className='whitespace-nowrap pl-1.5 sm:pl-2 '>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        )}
      </Table>
      {paginate && table.getPageCount() > 1 && (
        <div className='mt-3 flex items-center justify-center gap-2 py-3'>
          <Button
            type='button'
            className='px-3 py-1 rounded disabled:opacity-50'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <span className='text-sm'>
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            type='button'
            className='px-3 py-1 rounded disabled:opacity-50'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
