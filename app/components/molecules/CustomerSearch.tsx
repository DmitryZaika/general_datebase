import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CustomerForm } from '~/components/pages/CustomerForm'
import { cn } from '~/lib/utils'
import type { sourceEnum } from '~/schemas/customers'
import type { Customer } from '~/types'
import { Button } from '../ui/button'
import { Command, CommandGroup, CommandItem } from '../ui/command'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
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

async function fetchCustomerById(customerId: number) {
  const res = await fetch(`/api/customers/${customerId}`)
  if (!res.ok) return null
  const json = await res.json()
  return json.customer as Customer | null
}

const CustomerManager = ({
  selectedCustomer,
  setSearchTerm,
  setName,
  companyId,
  source,
  onCustomerChange,
}: {
  selectedCustomer: number | undefined
  setSearchTerm: (term: string | null) => void
  setName: (name: string | null) => void
  companyId: number
  source: (typeof sourceEnum)[number]
  onCustomerChange: (customerId: number) => void
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  function handleSuccess(value: number, name: string) {
    setIsOpen(false)
    setSearchTerm(null)
    setName(name)
    onCustomerChange(value)
  }

  function handleSpecial() {
    setIsOpen(true)
  }
  return (
    <>
      <Button
        type='button'
        variant='blue'
        size='sm'
        className='w-2/9 '
        onClick={handleSpecial}
      >
        {selectedCustomer ? 'Edit Customer' : 'Add Customer'}
      </Button>

      {isOpen && (
        <CustomerForm
          handleChange={setIsOpen}
          onSuccess={handleSuccess}
          companyId={companyId}
          customerId={selectedCustomer || undefined}
          source={source}
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

  useEffect(() => {
    if (error) {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      inputRef.current?.focus()
    }
  }, [error])
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

      <div className='relative flex flex-col gap-1'>
        <Label>Customer</Label>
        <Input
          ref={inputRef}
          placeholder='Start typing customer…'
          value={searchTerm ?? name ?? ''}
          onChange={e => {
            setSearchTerm(e.target.value)
            if (error) {
              setError(null)
            }
          }}
          disabled={!!selectedCustomer}
          autoFocus
        />
        {error && <CustomerSearchError error={error} className='text-red-500' />}
        {searchTerm && customerSuggestions.length > 0 && (
          <Command className='z-60 top-full mt-1 w-full h-auto max-h-50 overflow-y-auto border rounded-md bg-white shadow-md absolute'>
            <CommandGroup heading={isFetching ? 'Searching…' : 'Suggestions'}>
              {customerSuggestions.map(c => (
                <CommandItem key={c.id} onSelect={() => handleFinal(c.id)}>
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
            className='absolute -top-0 right-0 z-10 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 '
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
          onCustomerChange={onCustomerChange}
        />
      )}
    </div>
  )
}
