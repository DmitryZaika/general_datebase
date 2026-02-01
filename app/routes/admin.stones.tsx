//// filepath: c:\Users\sarah\general_datebase\app\routes\admin.stones.tsx

import { GridIcon, TableIcon } from '@radix-ui/react-icons'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FaPencilAlt, FaTimes } from 'react-icons/fa'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from 'react-router'
import ModuleList from '~/components/ModuleList'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { StoneSearch } from '~/components/molecules/StoneSearch'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import { OriginalSidebarTrigger } from '~/components/ui/sidebar'
import { cleanParams, useSafeSearchParams } from '~/hooks/use-safe-search-params'
import { stoneFilterSchema } from '~/schemas/stones'
import { withIconSuffix } from '~/utils/files'
import { type Stone, stoneQueryBuilder } from '~/utils/queries.server'
import { getAdminUser } from '~/utils/session.server'
import { capitalizeFirstLetter } from '~/utils/words'

function getStoneUrl(original: string | null) {
  return original ? withIconSuffix(original) : '/placeholder.png'
}

type ViewMode = 'grid' | 'table'

const VIEW_MODE = {
  GRID: 'grid',
  TABLE: 'table',
} as const

const DEFAULT_VIEW_MODE: ViewMode = VIEW_MODE.GRID

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await getAdminUser(request)
  const url = new URL(request.url)
  const cleanedParams = cleanParams(url.searchParams)
  const filters = stoneFilterSchema.parse(cleanedParams)
  const stones = await stoneQueryBuilder(filters, user.company_id, true)

  return { stones, companyId: user.company_id }
}

function StoneTable({ stones }: { stones: Stone[] }) {
  const location = useLocation()
  const navigate = useNavigate()

  const getEditUrl = (stoneId: number) => {
    return `edit/${stoneId}/information${location.search}`
  }

  const handleRowClick = (stoneId: number) => {
    const navigationPath = `${stoneId}${location.search}`
    navigate(navigationPath)
  }

  const columns: ColumnDef<Stone>[] = [
    {
      id: 'image',
      header: 'Image',
      cell: ({ row }) => {
        const stone = row.original
        const isOutOfStock = stone.available === 0
        const isRegularStock = !!stone.regular_stock

        return (
          <div className='w-12 h-12 overflow-hidden relative cursor-pointer'>
            <img
              src={getStoneUrl(stone.url)}
              alt={stone.name}
              className='object-cover w-full h-full'
            />
            {isOutOfStock && !isRegularStock && (
              <div className='absolute inset-0 flex items-center justify-center bg-red-500/70'>
                <span className='text-white text-[8px] font-bold rotate-0 text-center leading-tight px-0.5'>
                  Out of Stock
                </span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column} title='Name' />,
      cell: ({ row }) => <div className='font-medium'>{row.original.name}</div>,
    },
    {
      accessorKey: 'type',
      header: ({ column }) => <SortableHeader column={column} title='Type' />,
      cell: ({ row }) => <div>{capitalizeFirstLetter(row.original.type)}</div>,
    },
    {
      accessorFn: row => {
        const length = row.length || 0
        const width = row.width || 0
        return length * width
      },
      id: 'size',
      header: ({ column }) => <SortableHeader column={column} title='Size' />,
      cell: ({ row }) => {
        const stone = row.original
        const displayedWidth = stone.width && stone.width > 0 ? stone.width : '—'
        const displayedLength = stone.length && stone.length > 0 ? stone.length : '—'
        return <div>{`${displayedLength} × ${displayedWidth}`}</div>
      },
    },
    {
      accessorKey: 'available',
      header: ({ column }) => <SortableHeader column={column} title='Available' />,
      cell: ({ row }) => {
        const stone = row.original
        const isRegularStock = !!stone.regular_stock
        if (stone.available === 0 && isRegularStock) {
          return <div>Regular Stock</div>
        }
        return <div>{stone.available}</div>
      },
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <SortableHeader column={column} title='Amount' />,
      cell: ({ row }) => <div>{row.original.amount || '—'}</div>,
    },
    {
      accessorFn: row => row.retail_price || 0,
      id: 'retailPrice',
      header: ({ column }) => <SortableHeader column={column} title='Retail Price' />,
      cell: ({ row }) => (
        <div>{row.original.retail_price ? `$${row.original.retail_price}` : '—'}</div>
      ),
    },
    {
      accessorFn: row => row.cost_per_sqft || 0,
      id: 'costPerSqft',
      header: ({ column }) => <SortableHeader column={column} title='Cost per Sqft' />,
      cell: ({ row }) => (
        <div>{row.original.cost_per_sqft ? `$${row.original.cost_per_sqft}` : '—'}</div>
      ),
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
              edit: getEditUrl(row.original.id),
              delete: `delete/${row.original.id}${location.search}`,
            }}
          />
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      onRowClick={(stone: Stone) => handleRowClick(stone.id)}
      rowClassName={(
        stone: Stone,
      ) => `hover:bg-blue-100 active:bg-blue-200 cursor-pointer transition-all duration-200
                   hover:shadow-md ${stone?.is_display ? '' : 'opacity-60'}`}
      data={stones}
    />
  )
}

export default function AdminStones() {
  const { stones, companyId } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSafeSearchParams(stoneFilterSchema)
  const navigation = useNavigation()
  const navigate = useNavigate()
  const [isAddingStone, setIsAddingStone] = useState(false)
  const [sortedStones, setSortedStones] = useState<Stone[]>(stones)
  const location = useLocation()

  // Получаем viewMode из searchParams
  const viewMode: ViewMode = searchParams.viewMode || DEFAULT_VIEW_MODE

  useEffect(() => {
    const inStock = stones.filter(
      stone =>
        (Number(stone.available) > 0 || stone.regular_stock) &&
        Boolean(stone.is_display),
    )
    const outOfStock = stones.filter(
      stone =>
        Number(stone.available) <= 0 &&
        !stone.regular_stock &&
        Boolean(stone.is_display),
    )
    const notDisplayed = stones.filter(stone => !stone.is_display)

    const sortedInStock = [...inStock].sort((a, b) => a.name.localeCompare(b.name))
    const sortedOutOfStock = [...outOfStock].sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    const sortedNotDisplayed = [...notDisplayed].sort((a, b) =>
      a.name.localeCompare(b.name),
    )

    setSortedStones([...sortedInStock, ...sortedOutOfStock, ...sortedNotDisplayed])
  }, [stones])

  useEffect(() => {
    if (navigation.state === 'idle') {
      if (isAddingStone) setIsAddingStone(false)
    }
  }, [navigation.state])

  const handleAddStoneClick = () => {
    setIsAddingStone(true)
  }

  const getEditUrl = (stoneId: number) => {
    return `edit/${stoneId}/information${location.search}`
  }

  const toggleViewMode = (): void => {
    const newViewMode: ViewMode =
      viewMode === VIEW_MODE.GRID ? VIEW_MODE.TABLE : VIEW_MODE.GRID

    // Обновить URL параметры
    setSearchParams({ ...searchParams, viewMode: newViewMode })
  }
  return (
    <>
      <div className='flex justify-between flex-wrap items-center items-end mb-2'>
        <div className='flex items-center gap-4'>
          <div className='hidden md:block'>
            <OriginalSidebarTrigger />
          </div>
          <Button
            variant='outline'
            onClick={toggleViewMode}
            className='ml-2'
            title={
              viewMode === VIEW_MODE.GRID
                ? 'Switch to Table View'
                : 'Switch to Grid View'
            }
          >
            {viewMode === VIEW_MODE.GRID ? (
              <TableIcon className='mr-1' />
            ) : (
              <GridIcon className='mr-1' />
            )}
            {viewMode === VIEW_MODE.GRID ? 'Table View' : 'Grid View'}
          </Button>

          <Link
            to={`add${location.search}`}
            onClick={handleAddStoneClick}
            className='mr-auto'
          >
            <LoadingButton loading={isAddingStone}>
              <Plus className='w-4 h-4 mr-1' />
              Add Stone
            </LoadingButton>
          </Link>
        </div>
        <div className='flex-1 flex justify-center md:justify-end '>
          <StoneSearch userRole='admin' companyId={companyId} />
        </div>
      </div>

      <div>
        {viewMode === VIEW_MODE.GRID ? (
          <ModuleList>
            {sortedStones.map(stone => {
              const displayedAmount = stone.amount > 0 ? stone.amount : '—'
              const displayedAvailable = stone.available
              const displayedWidth = stone.width && stone.width > 0 ? stone.width : '—'
              const displayedLength =
                stone.length && stone.length > 0 ? stone.length : '—'

              const handleGridItemClick = () => {
                navigate(`${stone.id}${location.search}`)
              }

              const isRegularStock = !!stone.regular_stock
              const availableText =
                stone.available === 0 && isRegularStock
                  ? 'Regular Stock'
                  : `${displayedAvailable} / ${displayedAmount}${isRegularStock ? ' (Regular stock)' : ''}`

              return (
                <div
                  id={`stone-${stone.id}`}
                  key={stone.id}
                  className='relative w-full module-item'
                >
                  <div
                    className={`border-2 border-blue-500 rounded cursor-pointer hover:shadow-lg transition-all duration-200 ${
                      !stone.is_display ? 'opacity-30' : ''
                    }`}
                    onClick={handleGridItemClick}
                  >
                    <div className='relative'>
                      <img
                        src={getStoneUrl(stone.url)}
                        alt={stone.name || 'Stone Image'}
                        className='object-cover w-full h-40 rounded select-none'
                        loading='lazy'
                      />
                      {displayedAmount === '—' && !isRegularStock && (
                        <div className='absolute top-15 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap'>
                          <div className='bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none'>
                            Out of Stock
                          </div>
                        </div>
                      )}
                    </div>
                    <p className='text-center font-bold mt-2'>{stone.name}</p>
                    <p className='text-center text-sm'>Available: {availableText}</p>
                    <p className='text-center text-sm'>
                      Size: {displayedLength} x {displayedWidth}
                    </p>
                    <p className='text-center text-sm'>
                      Price: ${stone.retail_price}/${stone.cost_per_sqft}
                    </p>
                  </div>

                  <div className='absolute inset-0 flex justify-between items-start p-2 opacity-50 transition-opacity duration-300'>
                    <Link
                      to={getEditUrl(stone.id)}
                      className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2'
                      title='Edit Stone'
                      aria-label={`Edit ${stone.name}/information`}
                    >
                      <FaPencilAlt />
                    </Link>
                    <Link
                      to={`delete/${stone.id}${location.search}`}
                      className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2'
                      title='Delete Stone'
                      aria-label={`Delete ${stone.name}`}
                    >
                      <FaTimes />
                    </Link>
                  </div>
                </div>
              )
            })}
          </ModuleList>
        ) : (
          <StoneTable stones={sortedStones} />
        )}

        <Outlet />
      </div>
    </>
  )
}
