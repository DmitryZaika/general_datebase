import { useMemo, useState } from 'react'
import { type LoaderFunctionArgs, Outlet, useLoaderData } from 'react-router'
import ModuleList from '~/components/ModuleList'
import { ImageCard } from '~/components/organisms/ImageCard'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { cleanParams } from '~/hooks/use-safe-search-params'
import { faucetFilterSchema } from '~/schemas/faucets'
import { type Faucet, faucetQueryBuilder } from '~/utils/queries.server'
import { capitalizeFirstLetter } from '~/utils/words'

function sortCustomerFaucets(faucets: Faucet[]): Faucet[] {
  const eligible = faucets.filter(
    f =>
      f.url != null &&
      String(f.url).trim() !== '' &&
      (Number(f.available) > 0 || !!f.regular_stock) &&
      Boolean(f.is_display),
  )
  return [...eligible].sort((a, b) => a.name.localeCompare(b.name))
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const [, searchParams] = request.url.split('?')
  const queryParams = new URLSearchParams(searchParams)
  const filters = faucetFilterSchema.parse(cleanParams(queryParams))
  filters.show_sold_out = false
  const companyId = Number(params.company)
  const faucets = await faucetQueryBuilder(filters, companyId)
  return { faucets }
}

interface InteractiveCardProps {
  faucet: Faucet
  setCurrentId: (id: number, type: string) => void
  faucetType: string
}

function InteractiveCard({ faucet, setCurrentId, faucetType }: InteractiveCardProps) {
  return (
    <div
      id={`faucet-${faucet.id}`}
      className='relative group w-full module-item overflow-hidden'
      onAuxClick={e => {
        if (e.button === 1 && faucet.url) {
          e.preventDefault()
          window.open(faucet.url, '_blank')
        }
      }}
    >
      <ImageCard
        disabled={true}
        fieldList={{
          Type: capitalizeFirstLetter(faucet.type),
        }}
        title={faucet.name}
      >
        {faucet.url ? (
          <img
            src={faucet.url}
            alt={faucet.name || 'Faucet Image'}
            className='object-cover w-full h-40 border-2 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none'
            loading='lazy'
            onClick={() => setCurrentId(faucet.id, faucetType)}
          />
        ) : (
          <div
            className='w-full h-40 border-2 rounded cursor-pointer bg-gray-200'
            onClick={() => setCurrentId(faucet.id, faucetType)}
            role='button'
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setCurrentId(faucet.id, faucetType)}
          />
        )}
      </ImageCard>
    </div>
  )
}

export default function CustomerFaucets() {
  const { faucets } = useLoaderData<typeof loader>()
  const sortedFaucets = useMemo(() => sortCustomerFaucets(faucets), [faucets])
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const [, setActiveType] = useState<string | undefined>(undefined)

  const handleCardClick = (id: number, type: string) => {
    setCurrentId(id)
    setActiveType(type)
  }

  const handleCarouselChange = (id: number | undefined) => {
    setCurrentId(id)
    if (id !== undefined) {
      const faucet = sortedFaucets.find(f => f.id === id)
      if (faucet) {
        setActiveType(faucet.type)
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
            type='faucets'
            currentId={currentId}
            setCurrentId={handleCarouselChange}
            images={sortedFaucets}
            userRole='customer'
          />
        </div>
        {sortedFaucets.map(faucet => (
          <InteractiveCard
            key={faucet.id}
            faucet={faucet}
            setCurrentId={handleCardClick}
            faucetType={faucet.type}
          />
        ))}
      </ModuleList>
      <Outlet />
    </>
  )
}
