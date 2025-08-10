import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FaPencilAlt, FaTimes } from 'react-icons/fa'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router'
import ModuleList from '~/components/ModuleList'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { cleanParams } from '~/hooks/use-safe-search-params'
import { faucetFilterSchema } from '~/schemas/faucets'
import { FAUCET_TYPES } from '~/utils/constants'
import { type Faucet, faucetQueryBuilder } from '~/utils/queries.server'
import { getAdminUser } from '~/utils/session.server'

const formatPrice = (price: number | null | undefined): string => {
  if (price == null) return '-'

  return String(price).replace(/\.0+$/, '')
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${encodeURIComponent(String(error))}`)
  }

  const user = await getAdminUser(request)
  const [, searchParams] = request.url.split('?')
  const queryParams = new URLSearchParams(searchParams)

  if (!queryParams.has('show_sold_out')) {
    queryParams.set('show_sold_out', 'true')
  }

  const filters = faucetFilterSchema.parse(cleanParams(queryParams))

  const faucets = await faucetQueryBuilder(filters, user.company_id)

  return { faucets }
}

export default function AdminFaucets() {
  const { faucets } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const [isAddingFaucet, setIsAddingFaucet] = useState(false)
  const [sortedFaucets, setSortedFaucets] = useState<Faucet[]>(faucets)
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)

  const getTypePriority = (type: string) => {
    const index = FAUCET_TYPES.indexOf(type as (typeof FAUCET_TYPES)[number])
    return index === -1 ? FAUCET_TYPES.length : index
  }

  useEffect(() => {
    const inStock = faucets.filter(
      faucet => Number(faucet.available) > 0 && Boolean(faucet.is_display),
    )
    const outOfStock = faucets.filter(
      faucet =>
        (!faucet.available || Number(faucet.available) <= 0) &&
        Boolean(faucet.is_display),
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

  useEffect(() => {
    if (navigation.state === 'idle') {
      if (isAddingFaucet) setIsAddingFaucet(false)
    }
  }, [navigation.state])

  const handleAddFaucetClick = () => {
    setIsAddingFaucet(true)
  }

  const handleSetCurrentId = (id: number | undefined) => {
    setCurrentId(id)
  }

  return (
    <>
      <div className='flex justify-start mb-2'>
        <Link to='add' onClick={handleAddFaucetClick}>
          <LoadingButton className='mt-2 ml-2 -mb-3' loading={isAddingFaucet}>
            <Plus className='w-4 h-4 mr-1' />
            Add Faucet
          </LoadingButton>
        </Link>
      </div>

      <div>
        <ModuleList>
          <div className='w-full col-span-full'>
            <SuperCarousel
              type='faucets'
              currentId={currentId}
              setCurrentId={handleSetCurrentId}
              images={sortedFaucets}
            />
          </div>
          {sortedFaucets.map(faucet => {
            const displayedAmount =
              faucet.available && faucet.available > 0 ? faucet.available : '—'
            const retailPrice = formatPrice(faucet.retail_price)
            const cost = formatPrice(faucet.cost)

            return (
              <div key={faucet.id} className='relative w-full module-item'>
                <div
                  className={`border-2 border-blue-500 rounded ${
                    !faucet.is_display ? 'opacity-30' : ''
                  }`}
                >
                  <div className='relative'>
                    <img
                      src={faucet.url || '/placeholder.png'}
                      alt={faucet.name || 'Faucet Image'}
                      className='object-cover w-full h-40 rounded select-none cursor-pointer'
                      loading='lazy'
                      onClick={() => handleSetCurrentId(faucet.id)}
                    />
                    {displayedAmount === '—' && (
                      <div className='absolute top-15 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap'>
                        <div className='bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none'>
                          Out of Stock
                        </div>
                      </div>
                    )}
                  </div>

                  <p className='text-center font-bold mt-2'>{faucet.name}</p>
                  <p className='text-center text-sm'>Available: {displayedAmount}</p>
                  <p className='text-center text-sm'>
                    Price: ${retailPrice}/${cost}
                  </p>
                </div>

                <div className='absolute inset-0 flex justify-between items-start p-2 opacity-50'>
                  <Link
                    to={`edit/${faucet.id}`}
                    className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition'
                    title='Edit Faucet'
                    aria-label={`Edit ${faucet.name}`}
                  >
                    <FaPencilAlt />
                  </Link>
                  <Link
                    to={`delete/${faucet.id}`}
                    className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition'
                    title='Delete Faucet'
                    aria-label={`Delete ${faucet.name}`}
                  >
                    <FaTimes />
                  </Link>
                </div>
              </div>
            )
          })}
        </ModuleList>
        <Outlet />
      </div>
    </>
  )
}
