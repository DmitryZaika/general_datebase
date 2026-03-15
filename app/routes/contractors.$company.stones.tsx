import { useState } from 'react'
import { type LoaderFunctionArgs, Outlet, useLoaderData } from 'react-router'
import ModuleList from '~/components/ModuleList'
import { StoneSearch } from '~/components/molecules/StoneSearch'
import { ImageCard } from '~/components/organisms/ImageCard'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { db } from '~/db.server'
import { cleanParams } from '~/hooks/use-safe-search-params'
import { stoneFilterSchema } from '~/schemas/stones'
import { withIconSuffix } from '~/utils/files'
import { stoneQueryBuilder } from '~/utils/queries.server'
import { selectMany } from '~/utils/queryHelpers'
import { capitalizeFirstLetter } from '~/utils/words'

interface Stone {
  id: number
  name: string
  type: string
  url: string | null
  is_display: boolean | number
  length: number | null
  available: number
  width: number | null
  amount: number | null
  on_sale: boolean | number
  regular_stock: boolean | number
  created_date: string
  retail_price: number
  cost_per_sqft: number
  level: number | null
}

function getStoneUrl(original: string | null) {
  return original ? withIconSuffix(original) : ''
}

function sortStones(a: Stone, b: Stone) {
  const aAmount = a.amount ?? 0
  const bAmount = b.amount ?? 0
  if (aAmount === 0 && bAmount !== 0) return 1
  if (aAmount !== 0 && bAmount === 0) return -1
  return a.name.localeCompare(b.name)
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const [, searchParams] = request.url.split('?')
  const queryParams = new URLSearchParams(searchParams)
  const filters = stoneFilterSchema.parse(cleanParams(queryParams))
  filters.show_sold_out = false
  const rawStones = await stoneQueryBuilder(filters, Number(params.company))

  const stones = rawStones.map(stone => {
    let discount = 0
    if (stone.level === 1 || stone.level === 2) {
      discount = 3
    } else if (stone.level && stone.level >= 3) {
      discount = 5
    }
    return {
      ...stone,
      retail_price:
        stone.retail_price > 0 ? Math.max(0, stone.retail_price - discount) : 0,
      cost_per_sqft:
        stone.cost_per_sqft > 0 ? Math.max(0, stone.cost_per_sqft - discount) : 0,
    }
  })

  const colors = await selectMany<{
    id: number
    name: string
    hex_code: string
  }>(db, 'SELECT id, name, hex_code FROM colors ORDER BY name ASC')

  return { stones, colors, companyId: Number(params.company) }
}

interface InteractiveCardProps {
  stone: Stone
  setCurrentId: (id: number, type: string) => void
  stoneType: string
}

function InteractiveCard({ stone, setCurrentId, stoneType }: InteractiveCardProps) {
  const displayedWidth = stone.width && stone.width > 0 ? stone.width : '—'
  const displayedLength = stone.length && stone.length > 0 ? stone.length : '—'
  const isOnSale = !!stone.on_sale
  const isRegularStock = !!stone.regular_stock
  const createdDate = new Date(stone.created_date)
  const threeWeeksAgo = new Date()
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 30)
  const _isNew = createdDate > threeWeeksAgo

  return (
    <div
      id={`stone-${stone.id}`}
      className='relative group w-full module-item overflow-hidden'
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
      {/* TODO: Add slabs link */}
      <ImageCard
        type='slabs'
        itemId={stone.id}
        fieldList={{
          Size: `${displayedLength} x ${displayedWidth}`,
          Type: capitalizeFirstLetter(stone.type),
          Price:
            stone.retail_price === 0
              ? ` By slab $${stone.cost_per_sqft} sqft`
              : `$${stone.retail_price}`,
        }}
        disabled={true}
        title={stone.name}
      >
        <img
          src={getStoneUrl(stone.url)}
          alt={stone.name || 'Stone Image'}
          className='object-cover w-full h-40 border-2 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none'
          loading='lazy'
          onClick={() => setCurrentId(stone.id, stoneType)}
        />
      </ImageCard>
      {stone.available === 0 && !isRegularStock && (
        <div className='absolute top-16 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap'>
          <div className='bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none'>
            Out of Stock
          </div>
        </div>
      )}
      {/* {isNew && (
        <div className='absolute top-0 right-0 bg-green-500 text-white px-2 py-1 rounded-bl text-sm font-bold'>
          New Color
        </div>
      )} */}
    </div>
  )
}

export default function Stones() {
  const { stones, companyId } = useLoaderData<typeof loader>()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const [_, setActiveType] = useState<string | undefined>(undefined)

  const handleCardClick = (id: number, type: string) => {
    setCurrentId(id)
    setActiveType(type)
  }

  const handleCarouselChange = (id: number | undefined) => {
    setCurrentId(id)

    if (id !== undefined) {
      const stone = stones.find(s => s.id === id)
      if (stone) {
        setActiveType(stone.type)
      }
    } else {
      setActiveType(undefined)
    }
  }

  return (
    <>
      <div className='flex justify-center sm:justify-end'>
        <StoneSearch userRole='customer' companyId={companyId} />
      </div>

      <ModuleList>
        <div className='w-full col-span-full'>
          <SuperCarousel
            type='stones'
            currentId={currentId}
            setCurrentId={handleCarouselChange}
            images={stones}
            userRole='customer'
          />
        </div>
        {stones.sort(sortStones).map(stone => (
          <InteractiveCard
            key={stone.id}
            stone={stone}
            setCurrentId={handleCardClick}
            stoneType={stone.type}
          />
        ))}
      </ModuleList>
      <Outlet />
    </>
  )
}
