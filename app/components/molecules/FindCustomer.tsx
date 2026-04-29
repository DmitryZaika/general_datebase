import { useQuery } from '@tanstack/react-query'
import { Edit, Search, Trash } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { Customer } from '~/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

function detectSearchType(term: string): 'name' | 'phone' | 'email' {
  const value = term.trim()
  if (!value) return 'name'
  if (value.includes('@')) return 'email'
  const digits = value.replace(/\D/g, '')
  if (digits.length >= 4) return 'phone'
  return 'name'
}

export function FindCustomer({
  className,
  editBasePath = '/employee/customers',
  deleteBasePath = '/employee/customers',
  buildSearchUrl,
  buildEditLink,
  buildDeleteLink,
  onEdit,
  onDelete,
  onSelect,
  resolveId,
  noActionsLabel = 'No Items',
  showActions = true,
}: {
  className?: string
  disableRowClick?: boolean
  editBasePath?: string
  deleteBasePath?: string
  buildSearchUrl?: (term: string, searchType: 'name' | 'phone' | 'email') => string
  buildEditLink?: (customerId: number, search: string) => string
  buildDeleteLink?: (customerId: number, search: string) => string
  onEdit?: (customerId: number, customer: Customer) => void
  onDelete?: (customerId: number, customer: Customer) => void
  onSelect?: (customerId: number, customer: Customer) => void
  resolveId?: (customerId: number, customer?: Customer) => number | undefined
  noActionsLabel?: string
  showActions?: boolean
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [visibleCount, setVisibleCount] = useState(5)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', 'search', searchTerm, location.pathname],
    queryFn: async (): Promise<Customer[]> => {
      if (!searchTerm) return []

      const searchType = detectSearchType(searchTerm)
      const url = buildSearchUrl
        ? buildSearchUrl(searchTerm, searchType)
        : `/api/customers/search?term=${encodeURIComponent(searchTerm)}&searchType=${searchType}`

      const response = await fetch(url)
      if (!response.ok) return []

      const data = await response.json()
      return data?.customers || []
    },
    enabled: !!searchTerm,
  })

  // Sort customers: those with available actions (resolveId !== undefined) go first
  const sortedCustomers = useMemo(() => {
    if (!resolveId) return customers

    return [...customers].sort((a, b) => {
      const aHasAction = resolveId(a.id, a) !== undefined
      const bHasAction = resolveId(b.id, b) !== undefined

      if (aHasAction && !bHasAction) return -1
      if (!aHasAction && bHasAction) return 1
      return 0
    })
  }, [customers, resolveId])

  const displayCustomers = useMemo(
    () => sortedCustomers.slice(0, visibleCount),
    [sortedCustomers, visibleCount],
  )

  useEffect(() => {
    setVisibleCount(5)
  }, [searchTerm])

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

  return (
    <div ref={searchRef} className={`relative w-80 mt-2 md:mt-0 ${className}`}>
      <div className='relative'>
        <Input
          type='text'
          placeholder='Find Customer'
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={() => setIsInputFocused(true)}
          className='pr-10 rounded-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition'
        />
        <div className='absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500'>
          <Search />
        </div>
      </div>

      {isInputFocused && customers.length > 0 && (
        <div className='absolute z-50 w-full mt-2 bg-white shadow-xl rounded-lg border border-gray-200 max-h-72 overflow-y-auto'>
          {displayCustomers.map(customer => (
            <div
              key={customer.id}
              className='p-1.5 hover:bg-blue-50 border-b border-gray-100 last:border-none flex justify-between items-center'
            >
              <div className='flex-1 flex-row '>
                <div
                  className='font-medium text-gray-800 hover:underline cursor-pointer'
                  onClick={e => {
                    e.stopPropagation()
                    if (onSelect) {
                      onSelect(customer.id, customer)
                      setIsInputFocused(false)
                    }
                  }}
                >
                  {customer.name}
                </div>
                <div className='text-sm text-gray-500 flex flex-col '>
                  <p>{customer.email || ''}</p>
                  <p>{customer.phone || ''}</p>
                  {customer.phone_2 && <p>{customer.phone_2}</p>}
                </div>
              </div>
              {showActions && (
                <div className='flex items-center flex-col '>
                  {resolveId && resolveId(customer.id, customer) === undefined ? (
                    <span className='text-xs text-gray-500'>{noActionsLabel}</span>
                  ) : (
                    <>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={e => {
                          e.stopPropagation()
                          if (onEdit) {
                            onEdit(customer.id, customer)
                            return
                          }
                          const link = buildEditLink
                            ? buildEditLink(customer.id, location.search)
                            : `${editBasePath}/edit/${customer.id}${location.search}`
                          navigate(link)
                        }}
                        className='h-9 w-9 text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                      >
                        <Edit style={{ minWidth: '20px', minHeight: '20px' }} />
                      </Button>
                      {onDelete ? (
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={e => {
                            e.stopPropagation()
                            onDelete(customer.id, customer)
                          }}
                          className='h-9 w-9 text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                        >
                          <Trash style={{ minWidth: '20px', minHeight: '20px' }} />
                        </Button>
                      ) : (
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={e => {
                            e.stopPropagation()
                            const link = buildDeleteLink
                              ? buildDeleteLink(customer.id, location.search)
                              : `${deleteBasePath}/delete/${customer.id}${location.search}`
                            navigate(link)
                          }}
                          className='h-9 w-9 text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                        >
                          <Trash style={{ minWidth: '20px', minHeight: '20px' }} />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {customers.length > visibleCount && (
            <div className='p-2 flex justify-center'>
              <Button
                variant='ghost'
                size='sm'
                onClick={e => {
                  e.stopPropagation()
                  setVisibleCount(prev => prev + 5)
                }}
              >
                Show more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
