import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { FaEdit, FaSearch, FaTrash } from 'react-icons/fa'
import { useLocation, useNavigate } from 'react-router'
import { useToast } from '~/hooks/use-toast'
import type { Customer } from '~/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

async function getCustomers(name: string): Promise<Customer[]> {
  if (!name) return []
  const response = await fetch(
    `/api/customers/search?term=${encodeURIComponent(name)}&searchType=name`,
  )
  if (!response.ok) return []
  const data = await response.json()
  return data?.customers || []
}

export function FindCustomer({ className }: { className?: string }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { data: customers = [] } = useQuery({
    queryKey: ['customers', 'search', searchTerm],
    queryFn: () => getCustomers(searchTerm),
    enabled: !!searchTerm,
  })

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

  const handleResultClick = (customerId: number) => {
    navigate(`/employee/customers/view/${customerId}${location.search}`)
  }

  return (
    <div ref={searchRef} className={`relative w-80 mt-2 ${className}`}>
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
          <FaSearch />
        </div>
      </div>

      {isInputFocused && customers.length > 0 && (
        <div className='absolute z-50 w-full mt-2 bg-white shadow-xl rounded-lg border border-gray-200 max-h-72 overflow-y-auto'>
          {customers.map(customer => (
            <div
              key={customer.id}
              onClick={() => handleResultClick(customer.id)}
              className='p-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none flex justify-between items-center'
              onAuxClick={e => {
                if (e.button === 1) {
                  e.preventDefault()
                  e.stopPropagation()
                  window.open(
                    `/employee/customers/view/${customer.id}${location.search}`,
                    '_blank',
                  )
                }
              }}
            >
              <div className='flex-1 flex-row '>
                <div className='font-medium text-gray-800'>{customer.name}</div>
                <div className='text-sm text-gray-500 flex flex-col '>
                  <p>{customer.email || ''}</p>
                  <p>{customer.phone || ''}</p>
                </div>
              </div>
              <div className='flex items-center space-x-2'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={e => {
                    e.stopPropagation()
                    navigate(
                      `/employee/customers/edit/${customer.id}${location.search}`,
                    )
                  }}
                  className='h-11 w-11 text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                >
                  <FaEdit style={{ minWidth: '20px', minHeight: '20px' }} />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={e => {
                    e.stopPropagation()
                    ;(async () => {
                      const res = await fetch(
                        `/api/deals/count-by-customer/${customer.id}`,
                      )
                      if (res.ok) {
                        const json = await res.json()
                        if ((json.count ?? 0) > 0) {
                          toast({
                            title: 'Action required',
                            description: 'Delete all related deals with this customer.',
                            duration: 7000,
                            variant: 'destructive',
                          })
                          return
                        }
                      }

                      navigate(
                        `/employee/customers/delete/${customer.id}${location.search}`,
                      )
                    })()
                  }}
                  className='h-11 w-11 text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                >
                  <FaTrash style={{ minWidth: '16px', minHeight: '16px' }} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
