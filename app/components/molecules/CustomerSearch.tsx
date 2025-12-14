import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CustomerForm } from '~/components/pages/CustomerForm'
import { cn } from '~/lib/utils'
import type { CustomerDialogSchema, sourceEnum } from '~/schemas/customers'
import type { Customer, Sources } from '~/types/customer'
import { Button } from '../ui/button'
import { Command, CommandGroup, CommandItem } from '../ui/command'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { RawSelect } from './RawSelect'

const selectOptions = ['name', 'phone', 'email'] as const
type SelectOption = (typeof selectOptions)[number]

function CustomerSearchError({
  error,
  className,
}: {
  error: string | undefined
  className?: string
}) {
  return (
    <div>
      <p
        className={cn(
          'text-[0.8rem] font-medium text-red-500 dark:text-red-900',
          className,
        )}
      >
        {error}
      </p>
    </div>
  )
}

interface CustomerSearchProps {
  onCustomerChange: (customerId: number | undefined) => void
  selectedCustomer: number | undefined
  companyId: number
  source: (typeof sourceEnum)[number]
  error: string | undefined
  setError: (error: string | null) => void
}

const fetchCustomers = async (customerName: string, searchType: SelectOption) => {
  const name = encodeURIComponent(customerName)

  const url = `/api/customers/search?term=${name}&searchType=${searchType}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch slabs')
  }
  const data: { customers: Customer[] } = await response.json()
  return data.customers
}

async function fetchCustomerById(customerId: number): Promise<Customer | null> {
  const res = await fetch(`/api/customers/${customerId}`)
  if (!res.ok) return null
  const json = await res.json()
  return json.customer
}

const getOldData = (
  currentCustomer: Customer | undefined | null,
  selectedCustomer: number | undefined,
  source: (typeof sourceEnum)[number] | 'user-input',
): CustomerDialogSchema | undefined => {
  if (!currentCustomer) return undefined
  if (!selectedCustomer) return undefined

  const rawCompany =
    typeof currentCustomer.company_name === 'string'
      ? currentCustomer.company_name
      : null
  const rawMessage = currentCustomer.your_message ?? ''
  const builder = typeof rawCompany === 'string' && rawCompany.trim().length > 0
  const rawSource: Sources | 'user-input' =
    typeof currentCustomer.source === 'string' ? currentCustomer.source : source
  const mappedSource: Sources = rawSource === 'user-input' ? 'other' : rawSource
  return {
    name: currentCustomer.name,
    email: currentCustomer.email ?? '',
    phone: currentCustomer.phone ?? '',
    address: currentCustomer.address ?? '',
    your_message: rawMessage,
    builder,
    company_name: rawCompany,
    source: mappedSource,
  }
}

const CustomerManager = ({
  selectedCustomer,
  setSearchTerm,
  setName,
  companyId,
  source,
  currentText,
  onCustomerChange,
}: {
  selectedCustomer: number | undefined
  setSearchTerm: (term: string | null) => void
  setName: (name: string | null) => void
  companyId: number
  source: (typeof sourceEnum)[number]
  currentText: string | null
  onCustomerChange: (customerId: number) => void
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const queryClient = useQueryClient()
  const { data: currentCustomer } = useQuery({
    queryKey: ['customer-by-id', selectedCustomer],
    queryFn: () => fetchCustomerById(selectedCustomer || 0),
    enabled: !!selectedCustomer,
  })

  function handleSuccess(value: number, name: string) {
    setIsOpen(false)
    setSearchTerm(null)
    setName(name)
    onCustomerChange(value)
    queryClient.invalidateQueries({ queryKey: ['customer-by-id', value] })
  }

  function handleSpecial() {
    setIsOpen(true)
  }

  const oldData = getOldData(currentCustomer, selectedCustomer, source)
  const canShowForm = isOpen && (!selectedCustomer || !!currentCustomer)
  return (
    <>
      <Button
        type='button'
        variant='blue'
        size='sm'
        className='w-2/9 relative'
        onClick={handleSpecial}
      >
        {selectedCustomer ? 'Edit Customer' : 'Add Customer'}
        {selectedCustomer &&
          currentCustomer &&
          ((currentCustomer.email ?? '') === '' ||
            (currentCustomer.address ?? '') === '' ||
            (currentCustomer.phone ?? '') === '') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className='absolute -top-3 -right-3 z-10 cursor-help pointer-events-auto'>
                    <AlertCircle className='h-6 w-6 text-red-600' />
                  </span>
                </TooltipTrigger>
                <TooltipContent side='top' sideOffset={6}>
                  Missing customer info
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
      </Button>
      {canShowForm && (
        <CustomerForm
          handleChange={setIsOpen}
          onSuccess={handleSuccess}
          companyId={companyId}
          customerId={selectedCustomer || undefined}
          source={source}
          initialName={currentText ?? undefined}
          oldData={oldData}
        />
      )}
    </>
  )
}

export function CustomerSearch({
  onCustomerChange,
  selectedCustomer,
  companyId,
  source,
  error,
  setError,
}: CustomerSearchProps) {
  const [searchTerm, setSearchTerm] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<SelectOption>(selectOptions[0])
  const [name, setName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [isListOpen, setIsListOpen] = useState<boolean>(false)

  useEffect(() => {
    if (error) {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      inputRef.current?.focus()
    }
  }, [error])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(event: MouseEvent | TouchEvent) {
      const container = searchWrapRef.current
      if (!container) return
      const target = event.target as Node | null
      if (target && !container.contains(target)) {
        setIsListOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])
  useEffect(() => {
    const idNum = Number(selectedCustomer)
    if (idNum && !name) {
      fetchCustomerById(idNum).then(c => {
        if (c?.name) {
          setName(c.name)
        }
      })
    }
  }, [selectedCustomer])
  const { data: customerSuggestions = [], isFetching } = useQuery({
    queryKey: ['customers', selectedOption, searchTerm],
    queryFn: () => fetchCustomers(searchTerm ?? '', selectedOption),
    enabled: !!selectedOption && !!searchTerm,
  })

  function handleFinal(value: number) {
    onCustomerChange(value)
    const customer = customerSuggestions.find(c => c.id === value)
    setName(customer?.name ?? null)
    if (customer?.name) {
      setName(customer.name)
    }
    setSearchTerm(null)
  }

  function handleDeselect() {
    onCustomerChange(undefined)
    setName(null)
  }

  return (
    <div className='flex items-end gap-1'>
      {source !== 'check-list' && (
        <div className=''>
          <RawSelect
            label='Search by'
            options={selectOptions}
            value={selectedOption}
            onChange={value => {
              setSelectedOption(value)
              setSearchTerm(null)
            }}
          />
        </div>
      )}

      <div ref={searchWrapRef} className='relative flex w-full flex-col gap-1'>
        <Label>Customer</Label>
        <Input
          ref={inputRef}
          placeholder='Start typing customer…'
          value={searchTerm ?? name ?? ''}
          onChange={e => {
            setSearchTerm(e.target.value)
            setIsListOpen(e.target.value.length > 0)
            if (error) {
              setError(null)
            }
          }}
          onFocus={() => {
            if (searchTerm && searchTerm.length > 0) {
              setIsListOpen(true)
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setIsListOpen(false)
            }
          }}
          disabled={!!selectedCustomer}
          autoFocus
          className='w-full'
        />
        {error && <CustomerSearchError error={error} className='text-red-500' />}
        {isListOpen && customerSuggestions.length > 0 && (
          <Command className='z-60 top-full mt-1 w-full h-auto max-h-50 overflow-y-auto border rounded-md bg-white shadow-md absolute'>
            <CommandGroup heading={isFetching ? 'Searching…' : 'Suggestions'}>
              {customerSuggestions.map(c => (
                <CommandItem
                  key={c.id}
                  onSelect={() => {
                    setIsListOpen(false)
                    handleFinal(c.id)
                  }}
                >
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        )}
        {selectedCustomer && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute -top-0 right-0 z-10 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 h-6 w-6'
            onClick={handleDeselect}
          >
            <X className='h-3 w-3' />
          </Button>
        )}
      </div>
      {source !== 'check-list' && (
        <CustomerManager
          selectedCustomer={selectedCustomer}
          setSearchTerm={setSearchTerm}
          setName={setName}
          companyId={companyId}
          source={source}
          currentText={searchTerm ?? name}
          onCustomerChange={onCustomerChange}
        />
      )}
    </div>
  )
}
