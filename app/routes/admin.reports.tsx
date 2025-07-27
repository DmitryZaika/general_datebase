import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { PageLayout } from '~/components/PageLayout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { DataTable } from '~/components/ui/data-table'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface SlabReport {
  id: number
  bundle: string
  stone_name: string
  stone_id: number
  supplier_name: string
  supplier_id: number
  cut_date: string
  sale_date: string
  seller_name: string
}

function formatDate(dateString: string | null) {
  if (!dateString) return '-'

  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '-'

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return '-'
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const url = new URL(request.url)
  const reportType = url.searchParams.get('type') || 'cut_slabs'
  const fromDate = url.searchParams.get('fromDate') || ''
  const toDate = url.searchParams.get('toDate') || ''
  const supplierId = url.searchParams.get('supplier') || 'all'
  const stoneId = url.searchParams.get('stone') || 'all'

  const suppliers = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT id, supplier_name as name FROM suppliers ORDER BY supplier_name ASC`,
  )

  const stones = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT id, name FROM stones ORDER BY name ASC`,
  )

  let slabs: SlabReport[] = []
  let query = ''
  const queryParams: (string | number)[] = []

  switch (reportType) {
    case 'cut_slabs':
      query = `
        SELECT 
          slab_inventory.id,
          slab_inventory.bundle,
          stones.name as stone_name,
          stones.id as stone_id,
          suppliers.supplier_name as supplier_name,
          suppliers.id as supplier_id,
          slab_inventory.cut_date,
          sales.sale_date,
          users.name as seller_name
        FROM 
          slab_inventory
        LEFT JOIN 
          stones ON slab_inventory.stone_id = stones.id
        LEFT JOIN 
          suppliers ON stones.supplier_id = suppliers.id
        LEFT JOIN 
          sales ON slab_inventory.sale_id = sales.id
        LEFT JOIN 
          users ON sales.seller_id = users.id
        WHERE 
          slab_inventory.cut_date IS NOT NULL
          AND slab_inventory.parent_id IS NULL
      `

      if (fromDate) {
        query += ` AND DATE(slab_inventory.cut_date) >= ?`
        queryParams.push(fromDate)
      }
      if (toDate) {
        query += ` AND DATE(slab_inventory.cut_date) <= ?`
        queryParams.push(toDate)
      }

      if (supplierId && supplierId !== 'all') {
        const supplierIdNumber = parseInt(supplierId, 10)
        if (!Number.isNaN(supplierIdNumber)) {
          query += ` AND suppliers.id = ?`
          queryParams.push(supplierIdNumber)
        }
      }

      if (stoneId && stoneId !== 'all') {
        const stoneIdNumber = parseInt(stoneId, 10)
        if (!Number.isNaN(stoneIdNumber)) {
          query += ` AND stones.id = ?`
          queryParams.push(stoneIdNumber)
        }
      }

      query += ` ORDER BY slab_inventory.cut_date DESC`
      break
  }

  slabs = await selectMany<SlabReport>(db, query, queryParams)

  return {
    slabs,
    suppliers,
    stones,
    reportType,
    fromDate,
    toDate,
    supplierId,
    stoneId,
  }
}

const slabReportColumns: ColumnDef<SlabReport>[] = [
  {
    accessorKey: 'cut_date',
    header: ({ column }) => <SortableHeader column={column} title='Cut Date' />,
    cell: ({ row }) => {
      const cutDate = row.original.cut_date
      return cutDate ? formatDate(cutDate) : '-'
    },
    sortingFn: 'datetime',
  },

  {
    accessorKey: 'sale_date',
    header: ({ column }) => <SortableHeader column={column} title='Sale Date' />,
    cell: ({ row }) => formatDate(row.original.sale_date),
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'supplier_name',
    header: ({ column }) => <SortableHeader column={column} title='Supplier' />,
    cell: ({ row }) => row.original.supplier_name || '-',
  },
  {
    accessorKey: 'bundle',
    header: ({ column }) => <SortableHeader column={column} title='Bundle' />,
    cell: ({ row }) => row.original.bundle || '-',
  },
  {
    accessorKey: 'stone_name',
    header: ({ column }) => <SortableHeader column={column} title='Stone' />,
    cell: ({ row }) => row.original.stone_name || '-',
  },

  {
    accessorKey: 'seller_name',
    header: ({ column }) => <SortableHeader column={column} title='Sold By' />,
    cell: ({ row }) => row.original.seller_name || '-',
  },
]

export default function ReportsPage() {
  const {
    slabs,
    suppliers,
    stones,
    reportType,
    fromDate,
    toDate,
    supplierId,
    stoneId,
  } = useLoaderData<typeof loader>()
  const [isExporting, setIsExporting] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState(supplierId || 'all')
  const [selectedStoneId, setSelectedStoneId] = useState(stoneId || 'all')

  const getFilteredStones = () => {
    if (selectedSupplierId === 'all') return stones

    const stonesFromSelectedSupplier = slabs
      .filter(
        slab => slab.supplier_id && slab.supplier_id.toString() === selectedSupplierId,
      )
      .map(slab => ({ id: slab.stone_id, name: slab.stone_name }))

    const uniqueStones = Array.from(
      new Map(stonesFromSelectedSupplier.map(stone => [stone.id, stone])).values(),
    )

    return uniqueStones.length > 0 ? uniqueStones : stones
  }

  const filteredStones = getFilteredStones()

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSupplierId = e.target.value
    setSelectedSupplierId(newSupplierId)
    setSelectedStoneId('all')
  }

  const handleStoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStoneId(e.target.value)
  }

  const exportToCSV = () => {
    setIsExporting(true)

    try {
      const headers = [
        'Cut Date',
        'Bundle',
        'Stone',
        'Supplier',
        'Sale Date',
        'Sold By',
      ]
      const dataRows = slabs.map(slab => [
        slab.cut_date ? formatDate(slab.cut_date) : '',
        slab.bundle || '',
        slab.stone_name || '',
        slab.supplier_name || '',
        slab.sale_date ? formatDate(slab.sale_date) : '',
        slab.seller_name || '',
      ])

      const csvContent = [
        headers.join(','),
        ...dataRows.map(row =>
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        ),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute(
        'download',
        `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`,
      )
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <PageLayout title='Reports'>
      <div className='mb-6 w-[600px] mx-auto'>
        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription>Configure your report parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <form action='' method='get' className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium mb-2'>Report Type</label>
                  <select
                    name='type'
                    className='w-full border border-gray-300 rounded-md p-2'
                    defaultValue={reportType || 'cut_slabs'}
                  >
                    <option value='cut_slabs'>Cut Slabs</option>
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>Supplier</label>
                  <select
                    name='supplier'
                    className='w-full border border-gray-300 rounded-md p-2'
                    value={selectedSupplierId}
                    onChange={handleSupplierChange}
                  >
                    <option value='all'>All Suppliers</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>Stone</label>
                  <select
                    name='stone'
                    className='w-full border border-gray-300 rounded-md p-2'
                    value={selectedStoneId}
                    onChange={handleStoneChange}
                  >
                    <option value='all'>All Stones</option>
                    {filteredStones.map(stone => (
                      <option key={stone.id} value={stone.id.toString()}>
                        {stone.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>From Date</label>
                  <input
                    type='date'
                    name='fromDate'
                    className='w-full border border-gray-300 rounded-md p-2'
                    defaultValue={fromDate}
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>To Date</label>
                  <input
                    type='date'
                    name='toDate'
                    className='w-full border border-gray-300 rounded-md p-2'
                    defaultValue={toDate}
                  />
                </div>
              </div>

              <div className='flex justify-between w-full pt-4'>
                <button
                  type='submit'
                  className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md'
                >
                  Generate Report
                </button>

                <button
                  type='button'
                  onClick={exportToCSV}
                  disabled={isExporting || slabs.length === 0}
                  className='px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50'
                >
                  {isExporting ? 'Exporting...' : 'Export to CSV'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {reportType === 'cut_slabs' ? 'Cut Slabs Report' : 'Report'}
          </CardTitle>
          <CardDescription>
            Total items: {slabs.length}
            {fromDate && ` • From: ${fromDate}`}
            {toDate && ` • To: ${toDate}`}
            {supplierId !== 'all' &&
              ` • Supplier: ${suppliers.find(s => s.id.toString() === supplierId)?.name || supplierId}`}
            {stoneId !== 'all' &&
              ` • Stone: ${stones.find(s => s.id.toString() === stoneId)?.name || stoneId}`}
          </CardDescription>
        </CardHeader>
        <CardContent className='p-0'>
          {slabs.length > 0 ? (
            <DataTable columns={slabReportColumns} data={slabs} />
          ) : (
            <div className='py-10 text-center'>
              <p className='text-lg text-gray-500'>
                No data found for the selected filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
