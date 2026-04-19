import { useMemo, useState } from 'react'
import { type LoaderFunctionArgs, Outlet, useLoaderData } from 'react-router'
import ModuleList from '~/components/ModuleList'
import { ImageCard } from '~/components/organisms/ImageCard'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { cleanParams } from '~/hooks/use-safe-search-params'
import { sinkFilterSchema } from '~/schemas/sinks'
import { type Sink, sinkQueryBuilder } from '~/utils/queries.server'
import { capitalizeFirstLetter } from '~/utils/words'

function sortCustomerSinks(sinks: Sink[]): Sink[] {
  const eligible = sinks.filter(
    s =>
      s.url != null &&
      String(s.url).trim() !== '' &&
      (Number(s.available) > 0 || !!s.regular_stock) &&
      Boolean(s.is_display),
  )
  return [...eligible].sort((a, b) => a.name.localeCompare(b.name))
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const [, searchParams] = request.url.split('?')
  const queryParams = new URLSearchParams(searchParams)
  const filters = sinkFilterSchema.parse(cleanParams(queryParams))
  filters.show_sold_out = false
  const companyId = Number(params.company)
  const sinks = await sinkQueryBuilder(filters, companyId)
  return { sinks }
}

interface InteractiveCardProps {
  sink: Sink
  setCurrentId: (id: number, type: string) => void
  sinkType: string
}

function InteractiveCard({ sink, setCurrentId, sinkType }: InteractiveCardProps) {
  const displayedWidth = sink.width && sink.width > 0 ? sink.width : '—'
  const displayedLength = sink.length && sink.length > 0 ? sink.length : '—'
  return (
    <div
      id={`sink-${sink.id}`}
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
          Type: capitalizeFirstLetter(sink.type),
          Size: `${displayedLength} x ${displayedWidth}`,
        }}
        title={sink.name}
      >
        {sink.url ? (
          <img
            src={sink.url}
            alt={sink.name || 'Sink Image'}
            className='object-cover w-full h-40 border-2 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none'
            loading='lazy'
            onClick={() => setCurrentId(sink.id, sinkType)}
          />
        ) : (
          <div
            className='w-full h-40 border-2 rounded cursor-pointer bg-gray-200'
            onClick={() => setCurrentId(sink.id, sinkType)}
            role='button'
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setCurrentId(sink.id, sinkType)}
          />
        )}
      </ImageCard>
    </div>
  )
}

export default function CustomerSinks() {
  const { sinks } = useLoaderData<typeof loader>()
  const sortedSinks = useMemo(() => sortCustomerSinks(sinks), [sinks])
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const [, setActiveType] = useState<string | undefined>(undefined)

  const handleCardClick = (id: number, type: string) => {
    setCurrentId(id)
    setActiveType(type)
  }

  const handleCarouselChange = (id: number | undefined) => {
    setCurrentId(id)
    if (id !== undefined) {
      const sink = sortedSinks.find(s => s.id === id)
      if (sink) {
        setActiveType(sink.type)
      }
    } else {
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
            setCurrentId={handleCarouselChange}
            images={sortedSinks}
            userRole='customer'
          />
        </div>
        {sortedSinks.map(sink => (
          <InteractiveCard
            key={sink.id}
            sink={sink}
            setCurrentId={handleCardClick}
            sinkType={sink.type}
          />
        ))}
      </ModuleList>
      <Outlet />
    </>
  )
}
