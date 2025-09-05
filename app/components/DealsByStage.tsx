import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DataTable } from '~/components/ui/data-table'

type DealItem = {
  id: number
  list_id: number
  amount: number | null
}

type DealList = {
  id: number
  name: string
  position: number
}

type DealsByStageRow = {
  list_name: string
  deals_count: number
  total_amount: number
}

export function DealsByStage({
  deals,
  lists,
}: {
  deals: DealItem[]
  lists: DealList[]
}) {
  const currency = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    [],
  )

  const rows: DealsByStageRow[] = useMemo(() => {
    const byList = new Map<number, { count: number; total: number }>()
    for (const l of lists) byList.set(l.id, { count: 0, total: 0 })
    for (const d of deals) {
      const bucket = byList.get(d.list_id)
      if (!bucket) continue
      bucket.count += 1
      bucket.total += Number(d.amount || 0)
    }
    const mapped = lists
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(l => {
        const v = byList.get(l.id) || { count: 0, total: 0 }
        return { list_name: l.name, deals_count: v.count, total_amount: v.total }
      })
    return mapped
  }, [JSON.stringify(deals), JSON.stringify(lists)])

  const totalDeals = useMemo(
    () => rows.reduce((acc, r) => acc + (r.deals_count || 0), 0),
    [JSON.stringify(rows)],
  )

  const columns: ColumnDef<DealsByStageRow>[] = [
    { accessorKey: 'list_name', header: 'Stage' },
    {
      accessorKey: 'deals_count',
      header: 'Deals',
      cell: ({ row }) => {
        const count = row.original.deals_count || 0
        const pct = totalDeals > 0 ? Math.round((count / totalDeals) * 100) : 0
        return `${count} (${pct}%)`
      },
    },
    {
      accessorKey: 'total_amount',
      header: 'Total Amount',
      cell: ({ row }) => currency.format(row.original.total_amount || 0),
    },
  ]

  return <DataTable columns={columns} data={rows} />
}
