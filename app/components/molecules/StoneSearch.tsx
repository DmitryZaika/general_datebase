import { useState, useRef, useEffect } from 'react'
import { Input } from '~/components/ui/input'
import { FaSearch, FaChevronRight, FaEdit, FaImage, FaTrash } from 'react-icons/fa'
import { MinusIcon, CheckIcon } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '~/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { SuperCarousel } from '../organisms/SuperCarousel'

type UserRole = 'employee' | 'admin' | 'customer'

interface StoneSearchProps {
  userRole: UserRole
  className?: string
  mode?: 'default' | 'samples'
  onMinus?: (stoneId: number) => void
}

const highlightStyles = `
  @keyframes pulse-highlight {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
    70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  .stone-highlight {
    animation: pulse-highlight 2s ease-in-out;
    outline: 2px solid #3b82f6;
    position: relative;
    z-index: 10;
  }
`

const getStones = async (
  name: string,
  userRole: UserRole,
): Promise<
  {
    id: number
    name: string
    url: string
    retail_price: number
    cost_per_sqft: number
    available: number
  }[]
> => {
  const showSoldOut = userRole === 'admin' || userRole === 'employee'
  const response = await fetch(
    `/api/stones/search?name=${encodeURIComponent(name)}&show_sold_out=${showSoldOut}`,
  )
  const data = await response.json()
  return data?.stones || []
}

export function StoneSearch({
  userRole,
  className,
  mode = 'default',
  onMinus,
}: StoneSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const [doneStoneId, setDoneStoneId] = useState<number | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['stones', 'search', searchTerm, userRole],
    queryFn: () => getStones(searchTerm, userRole),
    enabled: !!searchTerm,
  })

  useEffect(() => {
    if (userRole === 'admin') {
      const styleElement = document.createElement('style')
      styleElement.textContent = highlightStyles
      document.head.appendChild(styleElement)

      return () => {
        document.head.removeChild(styleElement)
      }
    }
  }, [userRole])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsInputFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleResultClick = (stoneId: number) => {
    setCurrentId(stoneId)

    /*
    if (userRole === "admin") {
      const stoneElement = document.getElementById(`stone-${stoneId}`);
      if (stoneElement) {
        stoneElement.scrollIntoView({ behavior: "smooth", block: "center" });
        
        stoneElement.classList.add("stone-highlight");
        setTimeout(() => {
          stoneElement.classList.remove("stone-highlight");
        }, 2000);
      }
    }
    */
  }

  const handleSlabsClick = (stoneId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/employee/stones/slabs/${stoneId}${location.search}`)
  }

  const handleEditClick = (stoneId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/admin/stones/edit/${stoneId}/information${location.search}`)
  }

  const handleDeleteClick = (stoneId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/admin/stones/delete/${stoneId}${location.search}`)
  }

  return (
    <div ref={searchRef} className={`relative w-80 mt-2 ${className}`}>
      <div className='relative'>
        <Input
          type='text'
          placeholder='Stone Search'
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={() => setIsInputFocused(true)}
          className='pr-10 py-2 rounded-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition'
        />
        <div className='absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500'>
          <FaSearch />
        </div>
      </div>

      {isInputFocused && (
        <div className='absolute z-50 w-full mt-2 bg-white shadow-xl rounded-lg border border-gray-200 max-h-72 overflow-y-auto'>
          {data?.map(stone => (
            <div
              key={stone.id}
              onClick={e => {
                if (mode === 'samples' && onMinus) {
                  e.stopPropagation()
                  onMinus(stone.id)
                  setDoneStoneId(stone.id)
                  setTimeout(() => setDoneStoneId(null), 1000)
                } else {
                  handleResultClick(stone.id)
                }
              }}
              className='p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none flex justify-between items-center'
            >
              <div className='flex-1 flex-row '>
                <div className='font-medium text-gray-800'>
                  {stone.name}
                  {stone.available === 0 && (
                    <span className='ml-2 text-xs font-bold text-red-500'>
                      Out of Stock
                    </span>
                  )}
                </div>

                <div className='text-sm text-gray-500'>
                  {userRole === 'admin'
                    ? stone.retail_price === 0
                      ? `Price per slab $${stone.cost_per_sqft}`
                      : `Price: $${stone.retail_price} / $${stone.cost_per_sqft}`
                    : userRole === 'employee'
                      ? stone.retail_price === 0
                        ? `Price per slab $${stone.cost_per_sqft}`
                        : `Price: $${stone.retail_price}`
                      : ''}
                </div>
              </div>

              {userRole === 'employee' && mode === 'default' && (
                <div className='flex items-center space-x-2'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={e => handleSlabsClick(stone.id, e)}
                    className='h-11 w-11 text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                  >
                    Slabs
                  </Button>
                </div>
              )}

              {userRole === 'employee' && mode === 'samples' && (
                <div className='flex items-center space-x-2'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={e => {
                      e.stopPropagation()
                      if (onMinus) {
                        onMinus(stone.id)
                        setDoneStoneId(stone.id)
                        setTimeout(() => setDoneStoneId(null), 1000)
                      }
                    }}
                    className='h-11 w-11 text-red-500 hover:text-red-700 hover:bg-red-100'
                  >
                    {doneStoneId === stone.id ? (
                      <CheckIcon className='w-4 h-4 text-green-600' />
                    ) : (
                      <MinusIcon className='w-4 h-4' />
                    )}
                  </Button>
                </div>
              )}

              {userRole === 'admin' && (
                <>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={e => handleEditClick(stone.id, e)}
                    className='h-11 w-11 text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                  >
                    <FaEdit style={{ minWidth: '20px', minHeight: '20px' }} />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={e => handleDeleteClick(stone.id, e)}
                    className='h-11 w-11 text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                  >
                    <FaTrash style={{ minWidth: '16px', minHeight: '16px' }} />
                  </Button>
                </>
              )}

              {userRole === 'customer' && (
                <FaChevronRight className='h-4 w-4 text-gray-400' />
              )}
            </div>
          ))}
        </div>
      )}
      <SuperCarousel
        type='stones'
        currentId={currentId}
        setCurrentId={setCurrentId}
        images={data || []}
      />
    </div>
  )
}
