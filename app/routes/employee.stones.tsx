import { GridIcon, TableIcon } from '@radix-ui/react-icons'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useState } from 'react'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import ModuleList from '~/components/ModuleList'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { StoneSearch } from '~/components/molecules/StoneSearch'
import { ImageCard } from '~/components/organisms/ImageCard'
import { StoneTable } from '~/components/organisms/StoneTable'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Button } from '~/components/ui/button'
import { cleanParams } from '~/hooks/use-safe-search-params'
import { stoneFilterSchema } from '~/schemas/stones'
import { type Stone, stoneQueryBuilder } from '~/utils/queries.server'
import { getEmployeeUser } from '~/utils/session.server'
import { capitalizeFirstLetter } from '~/utils/words'

type ViewMode = 'grid' | 'table'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getEmployeeUser(request)
  const [, searchParams] = request.url.split('?')
  const queryParams = new URLSearchParams(searchParams)
  const filters = stoneFilterSchema.parse(cleanParams(queryParams))
  const stones = await stoneQueryBuilder(filters, user.company_id)
  return { stones }
}

function InteractiveCard({
  stone,
  setCurrentId,
}: {
  stone: Stone
  setCurrentId: (value: number) => void
  stoneType: string
}) {
  const displayedAmount = stone.amount > 0 ? stone.amount : '—'
  const createdDate = new Date(stone.created_date)
  const threeWeeksAgo = new Date()
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 30)
  const isNew = createdDate > threeWeeksAgo
  const isOnSale = !!stone.on_sale
  const navigate = useNavigate()
  const location = useLocation()

  const handleCardClick = () => {
    navigate(`slabs/${stone.id}${location.search}`)
  }

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentId(stone.id)
  }

  return (
    <div
      id={`stone-${stone.id}`}
      key={stone.id}
      className='relative group w-full module-item overflow-hidden cursor-pointer'
      onClick={handleCardClick}
      onAuxClick={e => {
        if (e.button === 1 && stone.url) {
          e.preventDefault()
          window.open(stone.url, '_blank')
        }
      }}
    >
      {isOnSale && (
        <div className='absolute top-[17px] left-[-40px] w-[140px] transform -rotate-45 z-10'>
          <div className='text-center py-1 text-white font-bold text-sm bg-red-600 shadow-md'>
            <span className='block relative z-10'>ON SALE</span>
            <div className='absolute left-0 top-full border-l-[10px] border-l-transparent border-t-[10px] border-t-red-800' />
            <div className='absolute right-0 top-full border-r-[10px] border-r-transparent border-t-[10px] border-t-red-800' />
          </div>
        </div>
      )}
      <ImageCard
        type='slabs'
        itemId={stone.id}
        fieldList={{
          Available: `${stone.available} / ${displayedAmount}`,

          Type: capitalizeFirstLetter(stone.type),

          Price:
            stone.retail_price === 0
              ? ` By slab $${stone.cost_per_sqft} sqft`
              : `$${stone.retail_price}`,
        }}
        title={stone.name}
      >
        <div onClick={e => e.stopPropagation()}>
          <img
            src={stone.url || '/placeholder.png'}
            alt={stone.name || 'Stone Image'}
            className='object-cover w-full h-40 border-2 border-gray-300 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none'
            loading='lazy'
            onClick={handleImageClick}
          />
        </div>
      </ImageCard>
      {stone.available === 0 && (
        <div className='absolute top-16 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap'>
          <div className='bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none'>
            Out of Stock
          </div>
        </div>
      )}
      {isNew && (
        <div className='absolute top-0 right-0 bg-green-500 text-white px-2 py-1 rounded-bl text-sm font-bold'>
          New Color
        </div>
      )}
    </div>
  )
}

export default function Stones() {
  const { stones } = useLoaderData<typeof loader>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const [sortedStones, setSortedStones] = useState<Stone[]>(stones)

  // Получаем viewMode из URL или используем "grid" по умолчанию
  const initialViewMode = (searchParams.get('viewMode') as ViewMode) || 'grid'
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const inStock = stones.filter(
      stone => Number(stone.available) > 0 && Boolean(stone.is_display),
    )
    const outOfStock = stones.filter(
      stone => Number(stone.available) <= 0 && Boolean(stone.is_display),
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

  const toggleViewMode = () => {
    const newViewMode = viewMode === 'grid' ? 'table' : 'grid'

    // Обновить состояние
    setViewMode(newViewMode)

    // Обновить URL параметры
    const newParams = new URLSearchParams(searchParams)
    newParams.set('viewMode', newViewMode)
    setSearchParams(newParams)
  }

  const columns: ColumnDef<Stone>[] = [
    {
      id: 'image',
      header: 'Image',
      cell: ({ row }) => {
        const stone = row.original
        const isOutOfStock = stone.available === 0

        return (
          <div
            className='w-12 h-12 overflow-hidden cursor-pointer relative'
            onClick={e => {
              e.stopPropagation()
              setCurrentId(stone.id)
            }}
          >
            <img
              src={stone.url || '/placeholder.png'}
              alt={stone.name}
              className='object-cover w-full h-full'
            />
            {isOutOfStock && (
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
      cell: ({ row }) => {
        return (
          <div
            className='font-medium cursor-pointer'
            onClick={() => navigate(`slabs/${row.original.id}${location.search}`)}
          >
            {row.original.name}
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: ({ column }) => <SortableHeader column={column} title='Type' />,
      cell: ({ row }) => capitalizeFirstLetter(row.original.type),
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
        return `${displayedLength} × ${displayedWidth}`
      },
    },
    {
      accessorKey: 'available',
      header: ({ column }) => <SortableHeader column={column} title='Available' />,
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <SortableHeader column={column} title='Amount' />,
      cell: ({ row }) => row.original.amount || '—',
    },
    {
      accessorFn: row => row.retail_price || 0,
      id: 'retailPrice',
      header: ({ column }) => <SortableHeader column={column} title='Retail Price' />,
      cell: ({ row }) =>
        row.original.retail_price ? `$${row.original.retail_price}` : '—',
    },
    {
      accessorFn: row => row.cost_per_sqft || 0,
      id: 'costPerSqft',
      header: ({ column }) => <SortableHeader column={column} title='Cost per Sqft' />,
      cell: ({ row }) =>
        row.original.cost_per_sqft ? `$${row.original.cost_per_sqft}` : '—',
    },
  ]

  return (
    <>
      <div className='flex justify-between flex-wrap items-center items-end mb-2'>
        <div className='flex items-center gap-4'>
          <Button
            variant='outline'
            onClick={toggleViewMode}
            className='ml-2'
            title={viewMode === 'grid' ? 'Switch to Table View' : 'Switch to Grid View'}
          >
            {viewMode === 'grid' ? (
              <TableIcon className='mr-1' />
            ) : (
              <GridIcon className='mr-1' />
            )}
            {viewMode === 'grid' ? 'Table View' : 'Grid View'}
          </Button>
        </div>
        <div className='flex-1 flex justify-center md:justify-end md:ml-auto'>
          <StoneSearch userRole='employee' />
        </div>
      </div>

      <div className='w-full col-span-full'>
        <SuperCarousel
          type='stones'
          currentId={currentId}
          setCurrentId={setCurrentId}
          images={sortedStones}
          userRole='employee'
        />
      </div>

      {viewMode === 'grid' ? (
        <ModuleList>
          {sortedStones.map(stone => (
            <InteractiveCard
              key={stone.id}
              stone={stone}
              setCurrentId={setCurrentId}
              stoneType={stone.type}
            />
          ))}
        </ModuleList>
      ) : (
        <StoneTable stones={sortedStones} columns={columns} />
      )}

      <Outlet />
    </>
  )
}
