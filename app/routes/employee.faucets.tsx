import { type LoaderFunctionArgs, Outlet, redirect, useLocation } from 'react-router'
import { selectMany } from '~/utils/queryHelpers'
import { db } from '~/db.server'
import { useLoaderData } from 'react-router'
import ModuleList from '~/components/ModuleList'
import { getEmployeeUser } from '~/utils/session.server'
import { ImageCard } from '~/components/organisms/ImageCard'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { useState, useEffect } from 'react'
import { faucetFilterSchema } from '~/schemas/faucets'
import { cleanParams } from '~/hooks/use-safe-search-params'
import { type Faucet, faucetQueryBuilder } from '~/utils/queries.server'
import { FAUCET_TYPES } from '~/utils/constants'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const user = await getEmployeeUser(request)
  const [, searchParams] = request.url.split('?')
  const queryParams = new URLSearchParams(searchParams)
  const filters = faucetFilterSchema.parse(cleanParams(queryParams))

  const faucets = await faucetQueryBuilder(filters, user.company_id)

  return { faucets }
}

function InteractiveCard({
  faucet,
  setCurrentId,
  disabled,
  faucetType,
}: {
  faucet: Faucet
  setCurrentId: (value: number, type: string) => void
  faucetType: string
  disabled: boolean
}) {
  const displayedAmount = faucet.amount && faucet.amount > 0 ? faucet.amount : '—'

  return (
    <div
      key={faucet.id}
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
          Amount: `${displayedAmount}`,
          Price:
            faucet.retail_price === 0 ? `Contact for price` : `$${faucet.retail_price}`,
        }}
        title={faucet.name}
      >
        <img
          src={faucet.url || '/placeholder.png'}
          alt={faucet.name || 'Faucet Image'}
          className='object-cover w-full h-40 border-2 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none'
          loading='lazy'
          onClick={() => setCurrentId(faucet.id, faucetType)}
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

export default function Faucets() {
  const { faucets } = useLoaderData<typeof loader>()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const [activeType, setActiveType] = useState<string | undefined>(undefined)
  const [sortedFaucets, setSortedFaucets] = useState<Faucet[]>(faucets)
  const location = useLocation()

  const getTypePriority = (type: string) => {
    const index = FAUCET_TYPES.indexOf(type as any)
    return index === -1 ? FAUCET_TYPES.length : index
  }

  useEffect(() => {
    const inStock = faucets.filter(
      faucet => Number(faucet.amount) > 0 && Boolean(faucet.is_display),
    )
    const outOfStock = faucets.filter(
      faucet => Number(faucet.amount) <= 0 && Boolean(faucet.is_display),
    )
    const notDisplayed = faucets.filter(faucet => !faucet.is_display)

    const sortByFaucetType = (a: Faucet, b: Faucet) => {
      const typePriorityA = getTypePriority(a.type)
      const typePriorityB = getTypePriority(b.type)

      if (typePriorityA !== typePriorityB) {
        return typePriorityA - typePriorityB
      }

      return a.name.localeCompare(b.name)
    }

    const sortedInStock = [...inStock].sort(sortByFaucetType)
    const sortedOutOfStock = [...outOfStock].sort(sortByFaucetType)
    const sortedNotDisplayed = [...notDisplayed].sort(sortByFaucetType)

    setSortedFaucets([...sortedInStock, ...sortedOutOfStock, ...sortedNotDisplayed])
  }, [faucets])

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
            type='faucets'
            currentId={currentId}
            setCurrentId={handleSetCurrentId}
            images={sortedFaucets}
          />
        </div>
        {sortedFaucets.map(faucet => (
          <InteractiveCard
            key={faucet.id}
            faucet={faucet}
            setCurrentId={handleSetCurrentId}
            faucetType={faucet.type}
            disabled={true}
          />
        ))}
      </ModuleList>
      <Outlet />
    </>
  )
}
