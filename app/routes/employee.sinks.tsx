import { useEffect, useState } from 'react'
import { type LoaderFunctionArgs, Outlet, redirect, useLoaderData } from 'react-router'
import ModuleList from '~/components/ModuleList'
import { ImageCard } from '~/components/organisms/ImageCard'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { cleanParams } from '~/hooks/use-safe-search-params'
import { sinkFilterSchema } from '~/schemas/sinks'
import { SINK_TYPES } from '~/utils/constants'
import { type Sink, sinkQueryBuilder } from '~/utils/queries.server'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const user = await getEmployeeUser(request)
  const [, searchParams] = request.url.split('?')
  const queryParams = new URLSearchParams(searchParams)
  const filters = sinkFilterSchema.parse(cleanParams(queryParams))

  const sinks = await sinkQueryBuilder(filters, user.company_id)

  return { sinks }
}

function InteractiveCard({
  sink,
  setCurrentId,
  sinkType,
}: {
  sink: Sink
  setCurrentId: (value: number, type: string) => void
  sinkType: string
}) {
  const displayedAmount = sink.amount && sink.amount > 0 ? sink.amount : '—'
  const displayedWidth = sink.width && sink.width > 0 ? sink.width : '—'
  const displayedLength = sink.length && sink.length > 0 ? sink.length : '—'

  return (
    <div
      key={sink.id}
      className='relative group w-full module-item overflow-hidden'
      onAuxClick={e => {
        if (e.button === 1 && sink.url) {
          e.preventDefault()
          window.open(sink.url, '_blank')
        }
      }}
    >
      <ImageCard
        disabled={true}
        fieldList={{
          Amount: `${displayedAmount}`,
          Size: `${displayedLength} x ${displayedWidth}  `,
          Price:
            sink.retail_price === 0 ? `Contact for price` : `$${sink.retail_price}`,
        }}
        title={sink.name}
      >
        <img
          src={sink.url || '/placeholder.png'}
          alt={sink.name || 'Sink Image'}
          className='object-cover w-full h-40 border-2 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none'
          loading='lazy'
          onClick={() => setCurrentId(sink.id, sinkType)}
        />
      </ImageCard>
      {displayedAmount === '—' && (
        <div className='absolute top-16 left-1/2 transform -translate-x-1/2 flex items-center justify-center cursor-pointer whitespace-nowrap'>
          <div className='bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none'>
            Out of Stock
          </div>
        </div>
      )}
    </div>
  )
}

export default function Sinks() {
  const { sinks } = useLoaderData<typeof loader>()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const [_, setActiveType] = useState<string | undefined>(undefined)
  const [sortedSinks, setSortedSinks] = useState<Sink[]>(sinks)

  const getTypePriority = (type: string) => {
    const index = SINK_TYPES.indexOf(type)
    return index === -1 ? SINK_TYPES.length : index
  }

  useEffect(() => {
    const inStock = sinks.filter(
      sink => Number(sink.amount) > 0 && Boolean(sink.is_display),
    )
    const outOfStock = sinks.filter(
      sink => Number(sink.amount) <= 0 && Boolean(sink.is_display),
    )
    const notDisplayed = sinks.filter(sink => !sink.is_display)

    const sortBySinkType = (a: Sink, b: Sink) => {
      const typePriorityA = getTypePriority(a.type)
      const typePriorityB = getTypePriority(b.type)

      if (typePriorityA !== typePriorityB) {
        return typePriorityA - typePriorityB
      }

      return a.name.localeCompare(b.name)
    }

    const sortedInStock = [...inStock].sort(sortBySinkType)
    const sortedOutOfStock = [...outOfStock].sort(sortBySinkType)
    const sortedNotDisplayed = [...notDisplayed].sort(sortBySinkType)

    setSortedSinks([...sortedInStock, ...sortedOutOfStock, ...sortedNotDisplayed])
  }, [sinks])

  const handleSetCurrentId = (id: number | undefined, type?: string) => {
    setCurrentId(id)
    if (type) {
      setActiveType(type)
    } else if (id === undefined) {
      setActiveType(undefined)
    }
  }

  return (
    <>
      <ModuleList>
        <div className='w-full col-span-full'>
          <SuperCarousel
            type='sinks'
            currentId={currentId}
            setCurrentId={handleSetCurrentId}
            images={sortedSinks}
          />
        </div>
        {sortedSinks.map(sink => (
          <InteractiveCard
            key={sink.id}
            sink={sink}
            setCurrentId={handleSetCurrentId}
            sinkType={sink.type}
          />
        ))}
      </ModuleList>
      <Outlet />
    </>
  )
}
